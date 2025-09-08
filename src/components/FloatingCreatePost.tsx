import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

const FloatingCreatePost = () => {
  const navigate = useNavigate();
  return (
    <button
      className="fab"
      aria-label="Create a new post"
      onClick={() => navigate('/add-post')}
      title="Create a new post"
    >
      <Plus className="h-5 w-5" />
    </button>
  );
};

export default FloatingCreatePost;
