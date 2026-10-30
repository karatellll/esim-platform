import { useAuth } from '../auth/AuthProvider';
import { ProfileAccountScreen } from './ProfileAccountScreen';
import { ProfileGuestScreen } from './ProfileGuestScreen';

export function ProfileScreen() {
  const { user } = useAuth();
  return user ? <ProfileAccountScreen user={user} /> : <ProfileGuestScreen />;
}
