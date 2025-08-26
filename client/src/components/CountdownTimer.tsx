import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CountdownTimerProps {
  endTime: Date;
  compact?: boolean;
}

export default function CountdownTimer({ endTime, compact = false }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const difference = end - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (compact) {
    return (
      <div className="flex items-center space-x-1">
        <Clock className="w-3 h-3" />
        <span className="text-xs">
          {timeLeft.days > 0 ? `${timeLeft.days}d ${timeLeft.hours}h` : 
           timeLeft.hours > 0 ? `${timeLeft.hours}h ${timeLeft.minutes}m` :
           `${timeLeft.minutes}m ${timeLeft.seconds}s`}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground p-6 rounded-lg" data-testid="countdown-timer">
      <div className="flex items-center justify-center space-x-4">
        <div className="text-center">
          <div className="text-3xl font-bold" data-testid="countdown-days">{timeLeft.days.toString().padStart(2, '0')}</div>
          <div className="text-sm opacity-80">Days</div>
        </div>
        <div className="text-2xl opacity-60">:</div>
        <div className="text-center">
          <div className="text-3xl font-bold" data-testid="countdown-hours">{timeLeft.hours.toString().padStart(2, '0')}</div>
          <div className="text-sm opacity-80">Hours</div>
        </div>
        <div className="text-2xl opacity-60">:</div>
        <div className="text-center">
          <div className="text-3xl font-bold" data-testid="countdown-minutes">{timeLeft.minutes.toString().padStart(2, '0')}</div>
          <div className="text-sm opacity-80">Minutes</div>
        </div>
        <div className="text-2xl opacity-60">:</div>
        <div className="text-center">
          <div className="text-3xl font-bold" data-testid="countdown-seconds">{timeLeft.seconds.toString().padStart(2, '0')}</div>
          <div className="text-sm opacity-80">Seconds</div>
        </div>
      </div>
      
      {timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0 && (
        <div className="text-center mt-4">
          <p className="text-lg font-semibold">Group purchase has ended!</p>
        </div>
      )}
    </div>
  );
}
