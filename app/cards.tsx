'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CardSetState } from './appState';
import { CardSet } from './cardSet';
import { GetCardSetsResponseData } from '@/pages/api/getCardSets';
import { v4 as uuid } from 'uuid';

export const Cards = () => {
  const [cardSets_, setCardSets] = useState<{ id: string; name: string }[]>([]);
  const [activeCardSet, setActiveCardSet] = useState<string | null>(null);
  const [newCardSet, setNewCardSet] = useState<string | null>(null);

  let cardSets: { id: string; name: string }[] = useMemo(() => {
    if (newCardSet && !cardSets_.some((s) => s.id === newCardSet)) {
      return [...cardSets_, { id: newCardSet, name: 'Deck' }];
    } else {
      return cardSets_;
    }
  }, [cardSets_, newCardSet]);

  useEffect(() => {
    const fetchCardSets = async () => {
      const result = (await (
        await fetch('api/getCardSets', { method: 'POST' })
      ).json()) as GetCardSetsResponseData;
      console.log(cardSets);
      if (result.cardSets) {
        setCardSets(result.cardSets);
      }
    };

    fetchCardSets();
    const handler = setInterval(fetchCardSets, 5000);
    return () => clearTimeout(handler);
  }, [cardSets]);

  useEffect(() => {
    if (!activeCardSet && cardSets.length > 0) {
      setActiveCardSet(cardSets[0].id);
    }
  }, [cardSets, activeCardSet]);

  console.log(cardSets);

  const tabClasses =
    'rounded-bl rounded-br px-4 py-2 hover:bg-blue-400 hover:text-white cursor-pointer';
  const activeTabClasses =
    'bg-blue-500 rounded-bl rounded-br px-4 py-2 text-white cursor-pointer';

  return (
    <div>
      <div className="flex gap-4 pb-10 justify-center">
        {cardSets.map(({ id, name }) => (
          <div
            className={activeCardSet === id ? activeTabClasses : tabClasses}
            key={id}
            onClick={() => setActiveCardSet(id)}
          >
            {name}
          </div>
        ))}
        <div
          className={tabClasses}
          key="new"
          onClick={() => {
            const newCardSetId = uuid();
            setActiveCardSet(newCardSetId);
            setNewCardSet(newCardSetId);
          }}
        >
          New
        </div>
      </div>
      {cardSets.map((c) => (
        <CardSet key={c.id} id={c.id} active={c.id === activeCardSet} />
      ))}
    </div>
  );
};
