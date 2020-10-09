const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('config');
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');

const User = require('../../models/User');

// @route    POST api/users
// @desc     Register user
// @access   Private
router.post(
  '/',
  [
    auth,
    [
      check('name', 'Name is required').not().isEmpty(),
      check('email', 'Please include a valid email').isEmail(),
      check(
        'password',
        'Please enter a password with 6 or more characters'
      ).isLength({ min: 6 }),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const name = req.body.name;
    const email = req.body.email.toLowerCase();
    const password = req.body.password;
    const role = req.body.role;

    try {
      let user = await User.findOne({ email });

      if (user) {
        return res
          .status(400)
          .json({ errors: [{ msg: 'User already exists' }] });
      }

      user = new User({
        name,
        email,
        password,
        role,
      });

      const salt = await bcrypt.genSalt(10);

      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = {
        user: {
          id: user.id,
        },
      };

      jwt.sign(
        payload,
        config.get('jwtSecret'),
        { expiresIn: 7200 },
        (err, token) => {
          if (err) throw err;
          res.json({ token });
        }
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route    PUT api/users
// @desc     Change password
// @access   Private
router.put(
  '/change-password',
  [
    auth,
    [
      check('password', 'New Password is required').not().isEmpty(),
      check('password2', 'Confirm New Password is required').not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const password = req.body.password;
    const password2 = req.body.password;
    const user = req.user.id;

    if (password !== password2) {
      return res.status(400).json({
        errors: [{ msg: 'Password confirmation does not match password' }],
      });
    }

    try {
      let userDetail = await User.findById(user);
      const salt = await bcrypt.genSalt(10);

      userDetail.password = await bcrypt.hash(password, salt);

      await userDetail.save();

      // await User.findOneAndUpdate({ _id: user }, { $set: { userDetail } });

      return res.status(200).json(await User.findOne({ _id: user }));
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

module.exports = router;
