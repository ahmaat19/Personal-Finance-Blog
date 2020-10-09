const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const auth = require('../../middleware/auth');
const fs = require('fs');
const path = require('path');

const Post = require('../../models/Post');
const User = require('../../models/User');
const checkObjectId = require('../../middleware/checkObjectId');

// @route    GET api/posts
// @desc     Get all posts
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ date: -1 })
      .populate('comments.user', ['name'])
      .populate('like.user', ['name'])
      .populate('user', ['name']);
    res.json(posts);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/post
// @desc     Create a post
// @access   Private
router.post(
  '/',
  [
    auth,
    [
      check('title', 'Title is required').not().isEmpty(),
      check('content', 'Content is required').not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (req.files === null)
      return res.status(400).json({
        errors: [
          {
            msg: 'Image is required',
            param: 'image',
            location: 'files',
          },
        ],
      });

    const { title, content, status, category } = req.body;
    const image = req.files.image;

    try {
      const postExist = await Post.findOne({
        title: title,
      });

      if (postExist) {
        return res.status(401).json({
          errors: [{ msg: 'This post already exist' }],
        });
      }

      const reqData = {
        fileName: Date.now() + image.name,
        mimeType: image.mimetype,
        fileSize: image.size,
        filePath: `/uploads/${Date.now() + image.name}`,
      };

      if (reqData.mimeType !== 'image/png') {
        return res.status(400).json({
          errors: [{ msg: 'Please, upload only JPEG, JPG, PNG images' }],
        });
      }

      // move file to uploads directory
      image.mv(
        path.join(
          __dirname,
          '...',
          `../../../client/public/uploads/${reqData.fileName}`
        )
      );

      const post = new Post({
        title,
        content,
        status,
        user: req.user.id,
        category: Array.isArray(category)
          ? category
          : category.split(',').map((cat) => ' ' + cat.trim()),
        image: reqData,
      });

      await post.save();

      res.json(
        await Post.find()
          .sort({ date: -1 })
          .populate('comments.user', ['name'])
          .populate('like.user', ['name'])
          .populate('user', ['name'])
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route    PUT api/post
// @desc     Update a post
// @access   Private
router.put(
  '/:id',
  [
    auth,
    checkObjectId('id'),
    [
      check('title', 'Title is required').not().isEmpty(),
      check('content', 'Content is required').not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (req.files === null)
      return res.status(400).json({
        errors: [
          {
            msg: 'Image is required',
            param: 'image',
            location: 'files',
          },
        ],
      });

    const { title, content, status, category } = req.body;
    const image = req.files.image;
    const id = req.params.id;
    const user = req.user.id;

    try {
      const reqData = {
        fileName: Date.now() + image.name,
        mimeType: image.mimetype,
        fileSize: image.size,
        filePath: `/uploads/${Date.now() + image.name}`,
      };

      if (reqData.mimeType !== 'image/png') {
        return res.status(400).json({
          errors: [{ msg: 'Please, upload only JPEG, JPG, PNG images' }],
        });
      }

      const postExist = await Post.findById(id);

      fs.unlink(
        path.join(
          __dirname,
          '...',
          `../../../client/public/uploads/${postExist.image.fileName}`
        ),
        (err) => {
          if (err) {
            console.error(err);
            return res.status(500).send(err);
          }
        }
      );

      // move file to uploads directory
      image.mv(
        path.join(
          __dirname,
          '...',
          `../../../client/public/uploads/${reqData.fileName}`
        )
      );

      let post = await Post.findOneAndUpdate(
        { _id: id },
        {
          $set: {
            user,
            title,
            content,
            status,
            category: Array.isArray(category)
              ? category
              : category.split(',').map((cat) => ' ' + cat.trim()),
            image: reqData,
          },
        }
      );

      res.json(
        await Post.find()
          .sort({ date: -1 })
          .populate('comments.user', ['name'])
          .populate('like.user', ['name'])
          .populate('user', ['name'])
      );
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route    DELETE api/post
// @desc     Update a post
// @access   Private
router.delete('/:id', [auth, checkObjectId('id')], async (req, res) => {
  const id = req.params.id;

  try {
    const postExist = await Post.findById({ _id: id });

    fs.unlink(
      path.join(
        __dirname,
        '...',
        `../../../client/public/uploads/${postExist.image.fileName}`
      ),
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send(err);
        }
      }
    );

    await Post.remove({ _id: id });

    res.json(
      await Post.find()
        .sort({ date: -1 })
        .populate('comments.user', ['name'])
        .populate('like.user', ['name'])
        .populate('user', ['name'])
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ================================== COMMENTS SECTION ======================

// @route    POST api/post/comment/:id
// @desc     Comment on a post
// @access   Private
router.post(
  '/comment/:id',
  [
    auth,
    checkObjectId('id'),
    [check('text', 'Text is required').not().isEmpty()],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const post = await Post.findById(req.params.id);

      const newComment = {
        text: req.body.text,
        user: req.user.id,
      };

      post.comments.unshift(newComment);

      await post.save();

      res.json(post.comments);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

// @route    DELETE api/post/comment/:id/:comment_id
// @desc     Delete comment
// @access   Private
router.delete('/comment/:id/:comment_id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    // Pull out comment
    const comment = post.comments.find(
      (comment) => comment.id === req.params.comment_id
    );
    // Make sure comment exists
    if (!comment) {
      return res.status(404).json({ msg: 'Comment does not exist' });
    }
    // Check user
    if (comment.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'User not authorized' });
    }

    post.comments = post.comments.filter(
      ({ id }) => id !== req.params.comment_id
    );

    await post.save();

    return res.json(post.comments);
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Server Error');
  }
});

module.exports = router;
