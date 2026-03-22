import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';

type BackButtonProps = {
  fallbackTo?: string;
  className?: string;
  label?: string;
};

const BackButton = ({
  fallbackTo = '/',
  className,
  label = 'Back',
}: BackButtonProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallbackTo);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleBack}
      className={className}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
};

export default BackButton;
