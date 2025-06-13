"use client";
import AddToCartButton from './AddToCartButton';

export default function AddToCartButtonClient(props: {
  id: string;
  title: string;
  price: number;
  image: string;
}) {
  return <AddToCartButton {...props} />;
} 