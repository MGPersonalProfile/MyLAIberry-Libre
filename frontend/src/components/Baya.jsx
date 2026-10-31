export default function Baya({ className = 'w-7 h-7' }) {
  return (
    <svg viewBox="200 140 640 700" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="baya-marca" cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ff4a52" />
          <stop offset="0.55" stopColor="#e50914" />
          <stop offset="1" stopColor="#8f0610" />
        </radialGradient>
        <radialGradient id="baya-marca-atras" cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#e3323b" />
          <stop offset="0.6" stopColor="#b8070f" />
          <stop offset="1" stopColor="#6e040b" />
        </radialGradient>
      </defs>
      <path d="M512 330 C 506 280, 520 236, 556 206" fill="none" stroke="#3f9a47" strokeWidth="22" strokeLinecap="round" />
      <path d="M556 206 C 610 150, 700 150, 752 196 C 690 262, 610 270, 556 206 Z" fill="#4fae55" />
      <circle cx="512" cy="450" r="150" fill="url(#baya-marca-atras)" />
      <circle cx="400" cy="640" r="168" fill="url(#baya-marca)" />
      <circle cx="622" cy="664" r="166" fill="#5a0309" fillOpacity="0.45" />
      <circle cx="630" cy="660" r="160" fill="url(#baya-marca)" />
      <ellipse cx="344" cy="584" rx="44" ry="27" transform="rotate(-30 344 584)" fill="#fff" fillOpacity="0.32" />
      <ellipse cx="576" cy="606" rx="42" ry="26" transform="rotate(-30 576 606)" fill="#fff" fillOpacity="0.32" />
    </svg>
  );
}
