import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
      className={cn(
        'inline-flex h-10 items-center justify-start gap-2 rounded-xl px-3 text-sm font-medium leading-none',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      <span className="leading-none">{label}</span>
    </Button>
  );
};

export default BackButton;
