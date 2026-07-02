// MediaRow — horizontal scrolling rail of media cards.
// Used on the dashboard and browse pages for "Recently Added", "Continue Watching", etc.

'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaRowProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function MediaRow({ title, children, className }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (delta: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  return (
    <section className={cn('group/row relative', className)}>
      {title && (
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-lg md:text-xl font-bold text-foreground">{title}</h2>
          <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => scrollBy(-600)}
              className="p-1.5 rounded-full bg-card/80 hover:bg-card text-foreground/70 hover:text-foreground transition"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(600)}
              className="p-1.5 rounded-full bg-card/80 hover:bg-card text-foreground/70 hover:text-foreground transition"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pb-2"
      >
        {children}
      </div>
    </section>
  );
}
