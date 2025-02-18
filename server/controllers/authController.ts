
import { Router } from 'express';
import { supabase } from '../config/db';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ message: error.message });
    }

    // Extract user data from Supabase session
    const user = data.session?.user;
    if (!user) {
      return res.status(401).json({ message: 'No user data in session' });
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      session: data.session
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
