import React from 'react';
import clsx from 'clsx';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  asChild?: boolean;
  className?: string;
  children: React.ReactNode;
};

const baseStyles =
  'inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none';

const variantStyles: Record<string, string> = {
  primary:
    'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow hover:shadow-lg hover:from-emerald-700 hover:to-teal-700',
  secondary:
    'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg',
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  ButtonProps
>(({ variant = 'primary', asChild = false, className, children, ...props }, ref) => {
  const classes = clsx(baseStyles, variantStyles[variant], className);
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<Record<string, unknown>>;
    const childClassName = typeof child.props.className === 'string' ? child.props.className : undefined;
    return React.cloneElement(child, {
      className: clsx(childClassName, classes),
    });
  }
  return (
    <button ref={ref} className={classes} {...props}>
      {children}
    </button>
  );
});
Button.displayName = 'Button';

export default Button; 