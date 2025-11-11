import express from "express";
import usermodel from "../models/user.model.js";

const router = express.Router();

// --- Login Route ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Please enter all fields" ,redirect: "/api/register"  });
  }

  try {
    // Find user by email
    const user = await usermodel.findOne({ email });

    if (!user) {
      return res.status(400).json({ msg: "User does not exist" });
    }

    // Check password (⚠️ plain-text for now — in real apps use bcrypt)
    if (user.password !== password) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // ✅ Success
    res.json({
      msg: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin
      }
    });

  } catch (error) {
    console.error("Error in login", error);
    return res.status(500).json({ msg: "Server Error" });
  }
});

export default router;
