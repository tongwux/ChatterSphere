import mongoose from 'mongoose';
const schema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true, maxlength: 4000 },
    clientMessageId: { type: String },
  },
  { timestamps: true },
);
schema.index({ senderId: 1, receiverId: 1, _id: -1 });
schema.index({ receiverId: 1, _id: -1 });
schema.index(
  { senderId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
);
export default mongoose.model('Message', schema);
