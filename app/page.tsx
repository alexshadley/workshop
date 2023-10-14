import Image from 'next/image';
import { useState } from 'react';
import { CardSet } from './cardSet';
import { Cards } from './cards';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <Cards></Cards>
    </main>
  );
}
