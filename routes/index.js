var express = require('express');
var router = express.Router();
let userModel = require("./users");
let flash = require("connect-flash");
const passport = require('passport');
let localStrategy = require("passport-local");
let nodemailer = require('nodemailer');
let crypto = require('crypto');

passport.use(new localStrategy(userModel.authenticate()));

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express', error: req.flash('error') });
});

router.get('/login', function (req, res, next) {
  res.render('login', { error: req.flash('error') });
});

router.get('/register', function (req, res, next) {
  res.render('register', { error: req.flash('error') });
});

router.get('/verifyotp', function (req, res, next) {
  res.render('verifyotp', { error: req.flash('error') });
});


router.get('/profile', isLoggedIn, async function(req, res, next) {
  try {
    let user = await userModel.findOne({ email: req.user.email });
    if (user) {
      res.render('profile', { title: 'Express', user: user });
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    next(error);
  }
});

router.get('/unauthorized', function (req, res, next) {
  res.render('unauthorized', { error: 'You are not authorized to view this page.' });
});

router.post("/login", passport.authenticate("local", {
  successRedirect: "/profile",
  failureRedirect: "/login",
  failureFlash: true
}));

router.get('/logout', function(req, res, next){
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated() && req.user && req.user.isVerified) {
    return next();
  }
  res.redirect("/verifyotp");
}

router.post("/register", function(req, res, next) {
  let otp = Math.floor(100000 + Math.random() * 900000);
  let userdata = new userModel({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    otp: otp,
    otpExpires: Date.now() + 3600000 // 1 hour
  });

  userModel.register(userdata, req.body.password)
  .then(function(registereduser) {
    // Send OTP email
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: "Acme <onboarding@resend.dev>",
        pass: 're_c1tpEyD8_NKFusih9vKVQknRAQfmFcWCv'
      }
    });

    let mailOptions = {
      from: "Acme <onboarding@resend.dev>",
      to: registereduser.email,
      subject: 'Email Verification',
      text: `Your OTP for email verification is ${otp}`
    };

    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        return console.log(error);
      }
      console.log('Email sent: ' + info.response);
    });

    res.redirect('/verifyotp');
  })
  .catch(function(err) {
    console.error("Error during registration:", err);
    req.flash('error', 'Registration failed');
    res.redirect('/register');
  });
});


router.post('/verifyotp', function(req, res, next) {
  console.log("Received email: ", req.body.email);
  console.log("Received OTP: ", req.body.otp);

  userModel.findOne({ email: req.body.email, otp: req.body.otp, otpExpires: { $gt: Date.now() } })
  .then(function(user) {
    if (!user) {
      console.log("No user found or OTP expired");
      return res.redirect('/verifyotp');
    }
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.save().then(function() {
      console.log("User verified and saved");
      req.login(user, function(err) { // Log the user in after verification
        if (err) {
          console.error("Error logging in user:", err);
          return next(err);
        }
        res.redirect('/profile');
      });
    });
  })
  .catch(function(err) {
    console.error("Error during verification:", err);
    return next(err);
  });
});

module.exports = router;
