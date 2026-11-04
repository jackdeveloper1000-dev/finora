export default function ProgressRing({ value, size = 84, stroke = 8 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${value}% complete`}>
      <svg width={size} height={size}>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        <circle className="ring__value" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <span className="ring__label">{value}%</span>
    </div>
  );
}
