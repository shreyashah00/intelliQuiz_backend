const { default: prisma } = require('../lib/prismaClient');
const { sendGroupInvitationEmail } = require('../utils/mailer');

/**
 * Create a new group
 */
exports.createGroup = async (req, res) => {
  try {
    const { Name, Description } = req.body;
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can create groups'
      });
    }

    if (!Name) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }

    const group = await prisma.group.create({
      data: {
        Name,
        Description,
        CreatedBy: teacherId
      }
    });

    res.status(201).json({
      success: true,
      message: 'Group created successfully',
      data: group
    });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during group creation'
    });
  }
};

/**
 * Get all groups created by the teacher
 */
exports.getGroups = async (req, res) => {
  try {
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view groups'
      });
    }

    const groups = await prisma.group.findMany({
      where: { CreatedBy: teacherId },
      include: {
        _count: {
          select: { Members: true }
        },
        Members: {
          include: {
            User: {
              select: {
                UserID: true,
                Username: true,
                Email: true,
                FirstName: true,
                LastName: true
              }
            }
          }
        }
      },
      orderBy: { CreatedAt: 'desc' }
    });

    res.json({
      success: true,
      data: groups
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching groups'
    });
  }
};

/**
 * Search users by email or username
 */
exports.searchUsers = async (req, res) => {
  try {
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can search users'
      });
    }

    const { query } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          {
            OR: [
              { Email: { contains: query, mode: 'insensitive' } },
              { Username: { contains: query, mode: 'insensitive' } }
            ]
          },
          { Role: 'student' },
          { EmailVerified: true },
          { AccountStatus: 'active' }
        ]
      },
      select: {
        UserID: true,
        Username: true,
        Email: true,
        FirstName: true,
        LastName: true
      },
      take: 20
    });

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during user search'
    });
  }
};

/**
 * Add students to a group and send invitation emails
 */
exports.addStudentsToGroup = async (req, res) => {
  try {
    const { GroupID, StudentIDs } = req.body;
    const teacherId = req.user.UserID;

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can add students to groups'
      });
    }

    if (!GroupID || !Array.isArray(StudentIDs) || StudentIDs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Group ID and student IDs are required'
      });
    }

    // Verify the group belongs to the teacher
    const group = await prisma.group.findFirst({
      where: { GroupID, CreatedBy: teacherId }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied'
      });
    }

    // Get existing members to avoid duplicates
    const existingMembers = await prisma.groupMember.findMany({
      where: {
        GroupID,
        UserID: { in: StudentIDs }
      },
      select: { UserID: true }
    });

    const existingUserIds = existingMembers.map(member => member.UserID);
    const newStudentIds = StudentIDs.filter(id => !existingUserIds.includes(id));

    if (newStudentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'All selected students are already in the group'
      });
    }

    // Get student details for email sending
    const students = await prisma.user.findMany({
      where: { UserID: { in: newStudentIds } },
      select: {
        UserID: true,
        Username: true,
        Email: true,
        FirstName: true,
        LastName: true
      }
    });

    // Create group members
    const groupMembers = await prisma.groupMember.createMany({
      data: newStudentIds.map(studentId => ({
        GroupID,
        UserID: studentId
      }))
    });

    // Send invitation emails
    const emailPromises = students.map(student =>
      sendGroupInvitationEmail(
        student.Email,
        student.Username,
        group.Name,
        GroupID
      )
    );

    await Promise.all(emailPromises);

    res.json({
      success: true,
      message: `Successfully added ${newStudentIds.length} students to the group and sent invitation emails`,
      data: {
        addedCount: newStudentIds.length,
        invitedStudents: students
      }
    });
  } catch (error) {
    console.error('Add students to group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding students to group'
    });
  }
};

/**
 * Remove a student from a group
 */
exports.removeStudentFromGroup = async (req, res) => {
  try {
    const { GroupID, UserID } = req.params;
    const teacherId = req.user.UserID;

    // Validate GroupID and UserID parameters
    if (!GroupID || isNaN(parseInt(GroupID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    if (!UserID || isNaN(parseInt(UserID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const parsedGroupId = parseInt(GroupID);
    const parsedUserId = parseInt(UserID);

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can remove students from groups'
      });
    }

    // Verify the group belongs to the teacher
    const group = await prisma.group.findFirst({
      where: { GroupID: parsedGroupId, CreatedBy: teacherId }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied'
      });
    }

    const deletedMember = await prisma.groupMember.deleteMany({
      where: {
        GroupID: parsedGroupId,
        UserID: parsedUserId
      }
    });

    if (deletedMember.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in the group'
      });
    }

    res.json({
      success: true,
      message: 'Student removed from group successfully'
    });
  } catch (error) {
    console.error('Remove student from group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing student from group'
    });
  }
};

/**
 * Get group members with their status
 */
exports.getGroupMembers = async (req, res) => {
  try {
    const { GroupID } = req.params;
    const teacherId = req.user.UserID;

    // Validate GroupID parameter
    if (!GroupID || isNaN(parseInt(GroupID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const parsedGroupId = parseInt(GroupID);

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can view group members'
      });
    }

    // Verify the group belongs to the teacher
    const group = await prisma.group.findFirst({
      where: { GroupID: parsedGroupId, CreatedBy: teacherId }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied'
      });
    }

    const members = await prisma.groupMember.findMany({
      where: { GroupID: parsedGroupId },
      include: {
        User: {
          select: {
            UserID: true,
            Username: true,
            Email: true,
            FirstName: true,
            LastName: true
          }
        }
      },
      orderBy: { InvitedAt: 'desc' }
    });

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching group members'
    });
  }
};

/**
 * Delete a group
 */
exports.deleteGroup = async (req, res) => {
  try {
    const { GroupID } = req.params;
    const teacherId = req.user.UserID;

    // Validate GroupID parameter
    if (!GroupID || isNaN(parseInt(GroupID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const parsedGroupId = parseInt(GroupID);

    // Validate teacher role
    const user = await prisma.user.findUnique({
      where: { UserID: teacherId }
    });

    if (user.Role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'Only teachers can delete groups'
      });
    }

    // Verify the group belongs to the teacher
    const group = await prisma.group.findFirst({
      where: { GroupID: parsedGroupId, CreatedBy: teacherId }
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found or access denied'
      });
    }

    // Delete the group (cascade will handle related records)
    await prisma.group.delete({
      where: { GroupID: parsedGroupId }
    });

    res.json({
      success: true,
      message: 'Group deleted successfully'
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting group'
    });
  }
};