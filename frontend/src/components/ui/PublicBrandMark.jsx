const sizeStyles = {
  header: {
    uploadedWrap:
      "h-14 w-14 rounded-2xl border border-orange-200 bg-white p-2 shadow-sm ring-1 ring-black/5",
    fallbackWrap:
      "h-12 w-[150px] rounded-[6px] bg-[#1f1d1b] px-5 shadow-sm",
    image: "h-full w-full",
  },
  footer: {
    uploadedWrap:
      "h-14 w-14 rounded-2xl border border-white/15 bg-white p-2 shadow-sm",
    fallbackWrap:
      "h-12 w-[150px] rounded-[6px] bg-[#1f1d1b] px-5 shadow-sm",
    image: "h-full w-full",
  },
  app: {
    uploadedWrap:
      "h-11 w-11 rounded-xl border border-orange-200 bg-white p-1.5 shadow-sm ring-1 ring-black/5",
    fallbackWrap: "h-10 w-10 rounded-lg bg-[#1f1d1b] p-1 shadow-sm",
    image: "h-full w-full",
  },
  hero: {
    uploadedWrap:
      "h-12 w-12 rounded-2xl border border-white/35 bg-white p-1.5 shadow-lg shadow-black/25 backdrop-blur-md",
    fallbackWrap:
      "h-10 w-[126px] rounded-[6px] bg-[#1f1d1b] px-4 shadow-lg shadow-black/20",
    image: "h-full w-full",
  },
};

const PublicBrandMark = ({
  src,
  alt = "Recruitment portal logo",
  uploaded = false,
  variant = "header",
  className = "",
}) => {
  const styles = sizeStyles[variant] || sizeStyles.header;
  const wrapClass = uploaded ? styles.uploadedWrap : styles.fallbackWrap;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden ${wrapClass} ${className}`}
    >
      <img
        src={src}
        alt={alt}
        className={`${styles.image} object-contain`}
        loading="eager"
        decoding="async"
      />
    </div>
  );
};

export default PublicBrandMark;
