'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import {
  fadeUpVariants,
  staggerContainerVariants,
  staggerItemVariants,
  cardHoverVariants,
  productImageHoverVariants,
  slideOutVariants,
  successVariants,
  ANIMATION_DURATIONS,
  EASING,
} from './motion-config';

/**
 * FadeUpContainer: Staggered fade-up animation for multiple children
 */
export const FadeUpContainer = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    delay?: number;
    className?: string;
  }
>(({ children, delay = 0, className }, ref) => (
  <motion.div
    ref={ref}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.3 }}
    variants={staggerContainerVariants}
    className={className}
    transition={{ delay: delay / 1000 }}
  >
    {React.Children.map(children, (child, index) => (
      <motion.div key={index} variants={staggerItemVariants}>
        {child}
      </motion.div>
    ))}
  </motion.div>
));

FadeUpContainer.displayName = 'FadeUpContainer';

/**
 * FadeUp: Single fade-up animation
 */
export const FadeUp = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    delay?: number;
    className?: string;
    once?: boolean;
  }
>(({ children, delay = 0, className, once = true }, ref) => (
  <motion.div
    ref={ref}
    initial="hidden"
    whileInView="visible"
    viewport={{ once, amount: 0.3 }}
    variants={fadeUpVariants}
    className={className}
    style={{
      transitionDelay: `${delay}ms`,
    }}
  >
    {children}
  </motion.div>
));

FadeUp.displayName = 'FadeUp';

/**
 * ProductCard: Premium card with hover lift and image zoom
 */
export const ProductCard = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }
>(({ children, onClick, className }, ref) => (
  <motion.div
    ref={ref}
    initial="rest"
    whileHover="hover"
    variants={cardHoverVariants}
    onClick={onClick}
    className={className}
  >
    {children}
  </motion.div>
));

ProductCard.displayName = 'ProductCard';

/**
 * ProductImage: Image with zoom on hover
 */
export const ProductImage = React.forwardRef<
  HTMLDivElement,
  React.ImgHTMLAttributes<HTMLImageElement> & {
    containerClassName?: string;
  }
>(({ containerClassName, alt = '', ...imgProps }, ref) => (
  <motion.div
    ref={ref}
    className={containerClassName}
    initial="rest"
    whileHover="hover"
    variants={productImageHoverVariants}
    style={{ overflow: 'hidden', position: 'relative' }}
  >
    <Image
      src={String(imgProps.src ?? '')}
      alt={alt}
      fill
      sizes="100vw"
      unoptimized
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  </motion.div>
));

ProductImage.displayName = 'ProductImage';

/**
 * AnimatedButton: Button with press feedback
 */
export const AnimatedButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    isLoading?: boolean;
    loadingSpinner?: React.ReactNode;
  }
>(({ isLoading, loadingSpinner, children, disabled, style, ...props }, ref) => (
  <button
    ref={ref}
    disabled={disabled || isLoading}
    {...props}
    style={style}
  >
    {isLoading ? loadingSpinner || 'Loading...' : children}
  </button>
));

AnimatedButton.displayName = 'AnimatedButton';

/**
 * RemoveAnimation: Slide out effect for removing items
 */
export const RemoveAnimation = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    onExitComplete?: () => void;
    className?: string;
  }
>(({ children, onExitComplete, className }, ref) => (
  <motion.div
    ref={ref}
    initial="hidden"
    exit="exit"
    variants={slideOutVariants}
    onAnimationComplete={onExitComplete}
    className={className}
  >
    {children}
  </motion.div>
));

RemoveAnimation.displayName = 'RemoveAnimation';

/**
 * SuccessAnimation: Brief success feedback animation
 */
export const SuccessAnimation = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    onExitComplete?: () => void;
    className?: string;
  }
>(({ children, onExitComplete, className }, ref) => (
  <motion.div
    ref={ref}
    initial="initial"
    animate="animate"
    exit="exit"
    variants={successVariants}
    onAnimationComplete={onExitComplete}
    className={className}
  >
    {children}
  </motion.div>
));

SuccessAnimation.displayName = 'SuccessAnimation';

/**
 * SkeletonLoader: Shimmer loading animation
 */
export const SkeletonLoader = React.forwardRef<
  HTMLDivElement,
  {
    width?: string | number;
    height?: string | number;
    count?: number;
    className?: string;
  }
>(({ width = '100%', height = 16, count = 1, className }, ref) => (
  <div ref={ref} className={className}>
    {Array.from({ length: count }).map((_, index) => (
      <motion.div
        key={index}
        className="bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 mb-3 rounded"
        style={{
          width,
          height,
          backgroundSize: '200% 100%',
        }}
        animate={{
          backgroundPosition: ['200% 0', '-200% 0'],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
    ))}
  </div>
));

SkeletonLoader.displayName = 'SkeletonLoader';

/**
 * NumberCounter: Animated counter for numeric values
 */
export const NumberCounter = ({
  from = 0,
  to,
  duration = 1,
  className,
  suffix = '',
  prefix = '',
}: {
  from?: number;
  to: number;
  duration?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}) => {
  const [displayValue, setDisplayValue] = React.useState(from);

  React.useEffect(() => {
    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    const updateCounter = () => {
      const now = Date.now();
      if (now < endTime) {
        const progress = (now - startTime) / (duration * 1000);
        const current = Math.floor(from + (to - from) * progress);
        setDisplayValue(current);
        requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(to);
      }
    };

    updateCounter();
  }, [from, to, duration]);

  return (
    <span className={className}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
};

/**
 * StaggerContainer: Wrapper for staggered child animations
 */
export const StaggerContainer = React.forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    staggerDelay?: number;
  }
>(({ children, className, staggerDelay = 0.04 }, ref) => (
  <motion.div
    ref={ref}
    initial="hidden"
    animate="visible"
    variants={{
      visible: {
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    }}
    className={className}
  >
    {React.Children.map(children, (child, index) => (
      <motion.div
        key={index}
        variants={{
          hidden: { opacity: 0, y: 10 },
          visible: {
            opacity: 1,
            y: 0,
            transition: {
              duration: ANIMATION_DURATIONS.NORMAL / 1000,
              ease: EASING.EASE_OUT,
            },
          },
        }}
      >
        {child}
      </motion.div>
    ))}
  </motion.div>
));

StaggerContainer.displayName = 'StaggerContainer';
