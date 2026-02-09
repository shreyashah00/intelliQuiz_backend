const bcrypt = require('bcryptjs');

const { default: prisma } = require('../lib/prismaClient');


exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.UserID;

    const user = await prisma.user.findUnique({
      where: { UserID: userId },
      select: {
        UserID: true,
        Username: true,
        Email: true,
        Role: true,
        FirstName: true,
        LastName: true,
        PhoneNumber: true,
        ProfilePicture: true,
        Bio: true,
        DateOfBirth: true,
        Gender: true,
        Address: true,
        City: true,
        Country: true,
        EmailVerified: true,
        AccountStatus: true,
        CreatedAt: true,
        UpdatedAt: true,
        LastLogin: true
      }
    });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while fetching profile' 
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.UserID;
    const {
      FirstName,
      LastName,
      PhoneNumber,
      Bio,
      DateOfBirth,
      Gender,
      Address,
      City,
      Country,
      ProfilePicture
    } = req.body;

    const updateData = {};
    if (FirstName !== undefined) updateData.FirstName = FirstName;
    if (LastName !== undefined) updateData.LastName = LastName;
    if (PhoneNumber !== undefined) updateData.PhoneNumber = PhoneNumber;
    if (Bio !== undefined) updateData.Bio = Bio;
    if (DateOfBirth !== undefined) updateData.DateOfBirth = new Date(DateOfBirth);
    if (Gender !== undefined) updateData.Gender = Gender;
    if (Address !== undefined) updateData.Address = Address;
    if (City !== undefined) updateData.City = City;
    if (Country !== undefined) updateData.Country = Country;
    if (ProfilePicture !== undefined) updateData.ProfilePicture = ProfilePicture;

    const updatedUser = await prisma.user.update({
      where: { UserID: userId },
      data: updateData,
      select: {
        UserID: true,
        Username: true,
        Email: true,
        Role: true,
        FirstName: true,
        LastName: true,
        PhoneNumber: true,
        ProfilePicture: true,
        Bio: true,
        DateOfBirth: true,
        Gender: true,
        Address: true,
        City: true,
        Country: true,
        UpdatedAt: true
      }
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while updating profile' 
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.UserID;
    const { CurrentPassword, NewPassword } = req.body;

    if (!CurrentPassword || !NewPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Current password and new password are required' 
      });
    }

    const user = await prisma.user.findUnique({ 
      where: { UserID: userId } 
    });

    const isPasswordValid = await bcrypt.compare(CurrentPassword, user.Password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Current password is incorrect' 
      });
    }

    const hashedPassword = await bcrypt.hash(NewPassword, 12);

    await prisma.user.update({
      where: { UserID: userId },
      data: {
        Password: hashedPassword,
        LastPasswordReset: new Date(),
        RefreshToken: null
      }
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please login again.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while changing password' 
    });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.UserID;
    const { Password } = req.body;

    if (!Password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required to delete account' 
      });
    }

    const user = await prisma.user.findUnique({ 
      where: { UserID: userId } 
    });

    const isPasswordValid = await bcrypt.compare(Password, user.Password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Password is incorrect' 
      });
    }

    await prisma.user.update({
      where: { UserID: userId },
      data: { AccountStatus: 'deleted' }
    });

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while deleting account' 
    });
  }
};

/**
 * Accept group invitation
 */
exports.acceptGroupInvitation = async (req, res) => {
  try {
    const { GroupID } = req.params;
    const userId = req.user.UserID;

    // Validate GroupID parameter
    if (!GroupID || isNaN(parseInt(GroupID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const parsedGroupId = parseInt(GroupID);

    // Check if the invitation exists and is pending
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        GroupID: parsedGroupId,
        UserID: userId,
        Status: 'pending'
      },
      include: {
        Group: {
          select: {
            GroupID: true,
            Name: true,
            Description: true,
            Creator: {
              select: {
                Username: true,
                FirstName: true,
                LastName: true
              }
            }
          }
        }
      }
    });

    if (!groupMember) {
      return res.status(404).json({
        success: false,
        message: 'Group invitation not found or already processed'
      });
    }

    // Update the membership status to accepted
    await prisma.groupMember.update({
      where: { GroupMemberID: groupMember.GroupMemberID },
      data: {
        Status: 'accepted',
        AcceptedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: `Successfully joined the group "${groupMember.Group.Name}"`,
      data: {
        group: groupMember.Group
      }
    });
  } catch (error) {
    console.error('Accept group invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while accepting group invitation'
    });
  }
};

/**
 * Reject group invitation
 */
exports.rejectGroupInvitation = async (req, res) => {
  try {
    const { GroupID } = req.params;
    const userId = req.user.UserID;

    // Validate GroupID parameter
    if (!GroupID || isNaN(parseInt(GroupID))) {
      return res.status(400).json({
        success: false,
        message: 'Invalid group ID'
      });
    }

    const parsedGroupId = parseInt(GroupID);

    // Check if the invitation exists and is pending
    const groupMember = await prisma.groupMember.findFirst({
      where: {
        GroupID: parsedGroupId,
        UserID: userId,
        Status: 'pending'
      },
      include: {
        Group: {
          select: {
            Name: true
          }
        }
      }
    });

    if (!groupMember) {
      return res.status(404).json({
        success: false,
        message: 'Group invitation not found or already processed'
      });
    }

    // Update the membership status to rejected
    await prisma.groupMember.update({
      where: { GroupMemberID: groupMember.GroupMemberID },
      data: {
        Status: 'rejected',
        RejectedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: `Rejected invitation to join the group "${groupMember.Group.Name}"`
    });
  } catch (error) {
    console.error('Reject group invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rejecting group invitation'
    });
  }
};

/**
 * Get user's groups and pending invitations
 */
exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.user.UserID;

    const groupMemberships = await prisma.groupMember.findMany({
      where: { UserID: userId },
      include: {
        Group: {
          select: {
            GroupID: true,
            Name: true,
            Description: true,
            CreatedAt: true,
            Creator: {
              select: {
                Username: true,
                FirstName: true,
                LastName: true
              }
            }
          }
        }
      },
      orderBy: { InvitedAt: 'desc' }
    });

    const acceptedGroups = groupMemberships.filter(m => m.Status === 'accepted');
    const pendingInvitations = groupMemberships.filter(m => m.Status === 'pending');

    res.json({
      success: true,
      data: {
        acceptedGroups: acceptedGroups.map(m => ({
          ...m.Group,
          joinedAt: m.AcceptedAt
        })),
        pendingInvitations: pendingInvitations.map(m => ({
          ...m.Group,
          invitedAt: m.InvitedAt
        }))
      }
    });
  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user groups'
    });
  }
};
