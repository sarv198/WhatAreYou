interface TRexSkullProps {
  className?: string;
}

/** A Tyrannosaurus skull in profile, facing right. Fills with the current text colour. */
export function TRexSkull({ className }: TRexSkullProps) {
  return (
    <svg className={className} viewBox="0 0 64 46" fill="currentColor" fillRule="evenodd" aria-hidden>
      {/* Cranium and upper jaw, with the skull windows, keyhole eye socket and nostril cut out. */}
      <path
        d="M4 6L14 3C17 2 20 3 22 5C24 3 26 3 28 4L50 8C56 9 60 12 61 17L61 21L58 22
           L56 27L54 22.5L51 28L49 23L46 28.5L44 23.5L41 28.5L39 24L36 28L34 24.5L31 27.5L29 25
           L22 26C18 27 14 30 11 34L7 33C4 28 3 18 4 6Z
           M7 12L13 9L14 22L9 26Z
           M16.6 10A2.6 2.6 0 1 1 21.8 10L20 17L18.4 17Z
           M25 9L42 12Q38 17 31 20L27 19Z
           M53 12.5a2 1.4 0 1 0 4 0a2 1.4 0 1 0-4 0Z"
      />
      {/* Lower jaw, dropped open. */}
      <path
        d="M12 37C14 34 18 32 24 31L28 31L30 27.5L32 31L35 31L37 27L39 31L42 31.5L44 27.5L46 32L49 32L51 28.5L53 32.5
           C55 33.5 55 36 52 37.5L30 42C22 44 15 43 12 37Z
           M18 37L26 35L23 39.5Z"
      />
    </svg>
  );
}
