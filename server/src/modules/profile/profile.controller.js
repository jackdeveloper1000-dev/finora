import { asyncHandler } from '../../utils/asyncHandler.js';
import * as profile from './profile.service.js';

export const get = asyncHandler(async (req, res) => {
  res.json({ profile: await profile.getProfile(req.user.id) });
});

export const save = asyncHandler(async (req, res) => {
  res.json({ profile: await profile.saveProfile(req.user.id, req.body) });
});
