const paths = {
  plus: 'M12 5v14M5 12h14',
  car: 'M5 16h14l-1.6-5.1A2.8 2.8 0 0 0 14.7 9H9.3a2.8 2.8 0 0 0-2.7 1.9L5 16Zm1 0v3m12-3v3M8 19h.01M16 19h.01M8 13h8',
  transit: 'M7 4h10a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Zm2 16 2-3m4 3-2-3M8 8h8M8 13h.01M16 13h.01',
  building: 'M6 21V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15M9 8h2m2 0h2M9 12h2m2 0h2M9 16h2m2 0h2M4 21h16',
}

export default function Icon({ name, size = 20, strokeWidth = 2.2, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      <path d={paths[name]} />
    </svg>
  )
}
