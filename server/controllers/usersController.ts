import { Router } from 'express';
import { supabase } from '../config/db';
import { authenticateSession } from '../auth';
import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

const router = Router();

router.get('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { data: allUsers, error } = await supabase
      .from('users')
      .select()
      .order('created_at');

    if (error) throw error;
    res.json(allUsers);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

router.get('/profile', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select()
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

router.post('/', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { data: existingUser } = await supabase
      .from('users')
      .select()
      .eq('email', req.body.email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        ...req.body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(newUser);
  } catch (error) {
    console.error('User creation error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
});

router.patch('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({
        ...req.body,
        updated_at: new Date().toISOString()
      })
      .eq('id', parseInt(req.params.id))
      .select()
      .single();

    if (error) throw error;
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('User update error:', error);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

router.delete('/:id', authenticateSession, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', parseInt(req.params.id));

    if (error) throw error;
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
});

export default router;