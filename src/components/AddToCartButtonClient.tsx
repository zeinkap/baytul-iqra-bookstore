"use client";
import AddToCartButton from './AddToCartButton';

export default function AddToCartButtonClient(props: {
  id: number;
  title: string;
  price: number;
  image: string;
}) {
  return <AddToCartButton {...props} />;
} 