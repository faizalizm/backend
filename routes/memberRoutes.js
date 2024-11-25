const express = require('express');

const getAllUsers = (req, res) => {
  res.status(200).json({
    status: 'ERROR',
    message: 'Service Not Available',
  });
};

const createUser = (req, res) => {
  res.status(200).json({
    status: 'ERROR',
    message: 'Service Not Available',
  });
};

const getUser = (req, res) => {
  res.status(200).json({
    status: 'ERROR',
    message: 'Service Not Available',
  });
};

const updateUser = (req, res) => {
  res.status(200).json({
    status: 'ERROR',
    message: 'Service Not Available',
  });
};

const deleteUser = (req, res) => {
  res.status(200).json({
    status: 'ERROR',
    message: 'Service Not Available',
  });
};

const router = express.Router();

router.route('/').get(getAllUsers).post(createUser);
router.route('/:id').get(getUser).patch(updateUser).delete(deleteUser);

module.exports = router;
