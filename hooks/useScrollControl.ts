import { useRef, UIEvent } from 'react';

export const useScrollControl = (setIsNavVisible?: (visible: boolean) => void) => {
  const lastScrollY = useRef(0);

  const handleScroll = (e: UIEvent<HTMLDivElement> | Event) => {
      if (!setIsNavVisible) return;
      
      // Handle both React SyntheticEvent and native Event
      const target = (e.target || e.currentTarget) as HTMLElement;
      const currentScrollY = target.scrollTop;
      
      if (currentScrollY < 0) return;

      const diff = currentScrollY - lastScrollY.current;
      if (Math.abs(diff) < 5) return;

      if (diff > 0 && currentScrollY > 50) {
          setIsNavVisible(false);
      } else if (diff < 0) {
          setIsNavVisible(true);
      }
      lastScrollY.current = currentScrollY;
  };

  return { handleScroll };
};