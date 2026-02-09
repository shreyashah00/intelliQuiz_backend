const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../utils/mailer');
const { default: prisma } = require('../lib/prismaClient');


const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { UserID: user.UserID, Email: user.Email, Role: user.Role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  const refreshToken = jwt.sign(
    { UserID: user.UserID },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

exports.register = async (req, res) => {
  try {
    const { Username, Email, Password, Role, FirstName, LastName } = req.body;

    if (!Username || !Email || !Password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, email, and password are required' 
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ Email }, { Username }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: existingUser.Email === Email ? 'Email already registered' : 'Username already taken' 
      });
    }

    const hashedPassword = await bcrypt.hash(Password, 12);
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        Username,
        Email,
        Password: hashedPassword,
        Role: Role || 'student',
        FirstName,
        LastName,
        OTP: otp,
        OTPExpiry: otpExpiry,
        OTPAttempts: 0
      }
    });

    await sendOTPEmail(Email, otp, Username);

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email with the OTP sent.',
      data: { Email: user.Email, Username: user.Username }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during registration' 
    });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { Email, OTP } = req.body;

    if (!Email || !OTP) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and OTP are required' 
      });
    }

    const user = await prisma.user.findUnique({ where: { Email } });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.EmailVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already verified' 
      });
    }

    if (user.OTPAttempts >= 5) {
      return res.status(429).json({ 
        success: false, 
        message: 'Too many failed attempts. Please request a new OTP.' 
      });
    }

    if (!user.OTP || !user.OTPExpiry) {
      return res.status(400).json({ 
        success: false, 
        message: 'No OTP found. Please request a new one.' 
      });
    }

    if (new Date() > user.OTPExpiry) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired. Please request a new one.' 
      });
    }

    if (user.OTP !== OTP) {
      await prisma.user.update({
        where: { Email },
        data: { OTPAttempts: user.OTPAttempts + 1 }
      });
      
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP. Please try again.' 
      });
    }

    await prisma.user.update({
      where: { Email },
      data: {
        EmailVerified: true,
        OTP: null,
        OTPExpiry: null,
        OTPAttempts: 0
      }
    });

    res.json({
      success: true,
      message: 'Email verified successfully. You can now login.'
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during verification' 
    });
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { Email } = req.body;

    if (!Email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const user = await prisma.user.findUnique({ where: { Email } });

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (user.EmailVerified) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already verified' 
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { Email },
      data: {
        OTP: otp,
        OTPExpiry: otpExpiry,
        OTPAttempts: 0
      }
    });

    await sendOTPEmail(Email, otp, user.Username);

    res.json({
      success: true,
      message: 'New OTP sent to your email'
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error while resending OTP' 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    const user = await prisma.user.findUnique({ where: { Email } });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    if (!user.EmailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: 'Please verify your email before logging in' 
      });
    }

    if (user.AccountStatus !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is suspended or inactive' 
      });
    }

    const isPasswordValid = await bcrypt.compare(Password, user.Password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    await prisma.user.update({
      where: { Email },
      data: {
        LastLogin: new Date(),
        RefreshToken: refreshToken
      }
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        user: {
          UserID: user.UserID,
          Username: user.Username,
          Email: user.Email,
          Role: user.Role,
          FirstName: user.FirstName,
          LastName: user.LastName,
          ProfilePicture: user.ProfilePicture
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login' 
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ 
        success: false, 
        message: 'Refresh token is required' 
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({ 
      where: { UserID: decoded.UserID } 
    });

    if (!user || user.RefreshToken !== refreshToken) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid refresh token' 
      });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    await prisma.user.update({
      where: { UserID: user.UserID },
      data: { RefreshToken: newRefreshToken }
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired refresh token' 
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const userId = req.user.UserID;

    await prisma.user.update({
      where: { UserID: userId },
      data: { RefreshToken: null }
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during logout' 
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { Email } = req.body;

    if (!Email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const user = await prisma.user.findUnique({ where: { Email } });

    if (!user) {
      return res.json({
        success: true,
        message: 'If the email exists, a password reset OTP has been sent'
      });
    }

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { Email },
      data: {
        OTP: otp,
        OTPExpiry: otpExpiry,
        OTPAttempts: 0
      }
    });

    await sendOTPEmail(Email, otp, user.Username, 'Password Reset');

    res.json({
      success: true,
      message: 'If the email exists, a password reset OTP has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { Email, OTP, NewPassword } = req.body;

    if (!Email || !OTP || !NewPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, OTP, and new password are required' 
      });
    }

    const user = await prisma.user.findUnique({ where: { Email } });

    if (!user || !user.OTP || user.OTP !== OTP) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid OTP' 
      });
    }

    if (new Date() > user.OTPExpiry) {
      return res.status(400).json({ 
        success: false, 
        message: 'OTP has expired' 
      });
    }

    const hashedPassword = await bcrypt.hash(NewPassword, 12);

    await prisma.user.update({
      where: { Email },
      data: {
        Password: hashedPassword,
        OTP: null,
        OTPExpiry: null,
        OTPAttempts: 0,
        LastPasswordReset: new Date(),
        RefreshToken: null
      }
    });

    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};
