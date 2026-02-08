const mongoose=require('mongoose');

const userSchema=new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  country: { type: String, required: true },
  password: { type: String, required: true },
  points: { type: Number, default: 0 },
  role: { type: String, default: 'user' },
  isActive: {type: Boolean, default: true,  },
  createdAt: { type: Date, default: Date.now }
  }, { timestamps: true });

module.exports=mongoose.model('User',userSchema);