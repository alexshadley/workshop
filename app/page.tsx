import Image from 'next/image';
import { useState } from 'react';
import { Cards } from './cards';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <Cards />
    </main>
  );
}
