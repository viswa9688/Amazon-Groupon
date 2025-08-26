interface GroupProgressProps {
  current: number;
  target: number;
}

export default function GroupProgress({ current, target }: GroupProgressProps) {
  const percentage = Math.min((current / target) * 100, 100);
  
  return (
    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
      <div 
        className="bg-accent h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
        data-testid="progress-bar"
      />
    </div>
  );
}
