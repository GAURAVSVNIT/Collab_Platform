import { useState } from 'react';

const Avatar = ({ 
  src, 
  alt, 
  fallbackText, 
  size = 40, 
  className = '',
  backgroundColor = '667eea',
  textColor = 'ffffff'
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // Generate fallback URL with proper encoding using placehold.co
  const fallbackUrl = `https://placehold.co/${size}x${size}/${backgroundColor}/${textColor}?text=${encodeURIComponent(fallbackText || '?')}`;

  return (
    <div className={`avatar ${className}`} style={{ width: size, height: size }}>
      {!hasError && src ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="strict-origin-when-cross-origin"
          onError={handleError}
          onLoad={handleLoad}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            display: isLoading ? 'none' : 'block'
          }}
        />
      ) : (
        <img
          src={fallbackUrl}
          alt={alt}
          referrerPolicy="strict-origin-when-cross-origin"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%'
          }}
        />
      )}
      {isLoading && (
        <div 
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            backgroundColor: '#f0f0f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999'
          }}
        >
          ...
        </div>
      )}
    </div>
  );
};

export default Avatar;
