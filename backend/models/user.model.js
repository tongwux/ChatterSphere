import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    username: { type: String, required: true, unique: true, match: /^[a-z0-9_]{3,24}$/ },
    password: { type: String, required: true, select: false },
  },
  { timestamps: true },
);
export default mongoose.model('User', schema);
