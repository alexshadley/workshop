'use client';

import { useState } from 'react';
import {
  PlusIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  ArrowUpOnSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import dragHandle from '../public/drag-handle.svg';
import Image from 'next/image';
import { Card, CardIndex, OriginalCard, useSyncedState } from './syncedState';
import { v4 as uuid } from 'uuid';

export const Cards = () => {
  const {
    appState: { cards, deck, hands },
    submitAdd,
    submitDelete,
    submitUpdate,
    submitMove,
    submitShuffle,
    submitAddHand,
    submitRemoveHand,
  } = useSyncedState();

  const drawTopCard = (handIndex: number) => {
    if (deck.length > 0) {
      submitMove({
        id: deck[0],
        destination: { type: 'hand', handIndex, position: 0 },
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!event.over) {
      return;
    }

    const dropData: any = event.over.data.current;
    const cardId: string = event.active.id as string;

    let destination;
    if (dropData.type === 'deck') {
      destination = { type: 'deck', position: 0 } as const;
    } else {
      destination = {
        type: 'hand',
        handIndex: dropData.handIndex,
        position: 0,
      } as const;
    }
    submitMove({ id: cardId, destination });
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div>
        <button
          onClick={() => submitAddHand()}
          className="border border-gray-500"
        >
          Add hand
        </button>
        {hands.map((h, i) => (
          <div className="mb-10" key={i}>
            <Hand
              handIndex={i}
              cards={cards}
              onUpdateCard={submitUpdate}
              handCards={h}
              onDrawTopCard={() => drawTopCard(i)}
              onDelete={() => submitRemoveHand(i)}
            />
          </div>
        ))}
        <Deck
          cards={cards}
          deck={deck}
          onShuffleDeck={submitShuffle}
          onNewCard={() => {
            submitAdd({
              type: 'original',
              id: uuid(),
              name: '',
              description: '',
              duplication: 1,
            });
          }}
          onUpdateCard={submitUpdate}
          onDeleteCard={submitDelete}
        />
      </div>
    </DndContext>
  );
};

const Deck = ({
  cards,
  deck,
  onShuffleDeck,
  onNewCard,
  onUpdateCard,
  onDeleteCard,
}: {
  cards: CardIndex;
  deck: string[];
  onShuffleDeck: () => void;
  onNewCard: () => void;
  onUpdateCard: (n: OriginalCard) => void;
  onDeleteCard: (id: string) => void;
}) => {
  const [name, setName] = useState('Deck');

  const [showAll, setShowAll] = useState(true);
  const [deleteMode, setDeleteMode] = useState(false);

  const { isOver, setNodeRef } = useDroppable({
    id: 'deck',
    data: {
      type: 'deck',
    },
  });

  return (
    <div>
      <div style={{ width: '600px' }} ref={setNodeRef}>
        <div className="flex justify-between mb-4">
          <EditableText value={name} onChange={setName} classes="text-xl" />
          <div className="flex gap-2">
            <TrashIcon
              className="w-6 h-6 cursor-pointer"
              onClick={() => setDeleteMode(!deleteMode)}
            />
            {showAll ? (
              <EyeSlashIcon
                className="w-6 h-6 cursor-pointer"
                onClick={() => setShowAll(false)}
              />
            ) : (
              <EyeIcon
                className="w-6 h-6 cursor-pointer"
                onClick={() => setShowAll(true)}
              />
            )}
            <ArrowPathIcon
              className="w-6 h-6 cursor-pointer"
              onClick={onShuffleDeck}
            />
            <PlusIcon className="w-6 h-6 cursor-pointer" onClick={onNewCard} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {deck.map((id) => {
            let originalCard: OriginalCard;
            const card = cards[id];
            if (card.type === 'original') {
              originalCard = card;
            } else {
              originalCard = cards[card.parentId] as OriginalCard;
            }

            return (
              <CardTile
                id={id}
                shown={showAll}
                deleteMode={deleteMode}
                key={id}
                originalCard={originalCard}
                onUpdate={onUpdateCard}
                onDelete={() => onDeleteCard(originalCard.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

const CardTile = ({
  id,
  originalCard,
  shown = true,
  deleteMode,
  onUpdate,
  onDelete,
}: {
  id: string;
  originalCard: OriginalCard;
  shown?: boolean;
  deleteMode?: boolean;
  onUpdate: (newCard: OriginalCard) => void;
  onDelete?: () => void;
}) => {
  const [individuallyShown, setIndividuallyShown] = useState(false);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      className="flex p-2 border rounded border-gray-300 bg-gray-100 h-10 group"
      style={style}
    >
      <Image
        src={dragHandle}
        alt="drag handle"
        width={24}
        height={24}
        ref={setNodeRef}
        {...listeners}
        {...attributes}
      />
      <div className="w-11/12">
        {(shown || individuallyShown) && (
          <>
            <EditableText
              placeholder="Name"
              value={originalCard.name}
              onChange={(newVal) => onUpdate({ ...originalCard, name: newVal })}
              classes="w-1/4"
            />
            <EditableText
              placeholder="Description"
              value={originalCard.description}
              onChange={(newVal) =>
                onUpdate({ ...originalCard, description: newVal })
              }
              classes="w-3/4"
            />
          </>
        )}
      </div>
      <div className="flex justify-end w-1/12">
        {!shown && individuallyShown && (
          <EyeSlashIcon
            className="w-6 h-6 cursor-pointer"
            onClick={() => setIndividuallyShown(false)}
          />
        )}
        {!shown && !individuallyShown && (
          <EyeIcon
            className="w-6 h-6 cursor-pointer"
            onClick={() => setIndividuallyShown(true)}
          />
        )}
        {deleteMode && (
          <TrashIcon className="w-6 h-6 cursor-pointer" onClick={onDelete} />
        )}
        {!deleteMode && shown && (
          <>
            <XMarkIcon
              className={
                'w-3 h-3' +
                (originalCard.duplication === 1
                  ? ' invisible group-hover:visible focus:visible'
                  : '')
              }
              style={{ marginTop: '5px', marginRight: '3px' }}
            />
            <EditableNumber
              classes={
                'w-6' +
                (originalCard.duplication === 1
                  ? ' invisible group-hover:visible focus:visible'
                  : '')
              }
              value={originalCard.duplication}
              onChange={(newVal) =>
                onUpdate({ ...originalCard, duplication: newVal })
              }
            />
          </>
        )}
      </div>
    </div>
  );
};

const EditableNumber = ({
  placeholder,
  value,
  onChange,
  classes,
}: {
  placeholder?: string;
  value: number;
  onChange: (n: number) => void;
  classes?: string;
}) => {
  const [localValue, setLocalValue] = useState<string | null>(null);

  return (
    <input
      placeholder={placeholder}
      className={`bg-transparent outline-none ${classes}`}
      value={localValue ?? value}
      onChange={(e) => {
        setLocalValue(e.target.value);
      }}
      onBlur={() => {
        if (localValue && !Number.isNaN(parseInt(localValue))) {
          onChange(parseInt(localValue));
        }
        setLocalValue(null);
      }}
    />
  );
};

const EditableText = ({
  placeholder,
  value,
  onChange,
  classes,
}: {
  placeholder?: string;
  value: string;
  onChange: (n: string) => void;
  classes?: string;
}) => {
  return (
    <input
      placeholder={placeholder}
      className={`bg-transparent outline-none ${classes}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

const Hand = ({
  handIndex,
  cards,
  onUpdateCard,
  handCards,
  onDrawTopCard,
  onDelete,
}: {
  handIndex: number;
  cards: { [id: string]: Card };
  onUpdateCard: (updatedCard: OriginalCard) => void;
  handCards: string[];
  onDrawTopCard: () => void;
  onDelete: () => void;
}) => {
  const [name, setName] = useState('Hand');

  const { isOver, setNodeRef } = useDroppable({
    id: `hand-${handIndex}`,
    data: {
      type: 'hand',
      handIndex,
    },
  });

  return (
    <div ref={setNodeRef}>
      <div style={{ width: '600px' }}>
        <div className="flex justify-between mb-4">
          <EditableText value={name} onChange={setName} classes="text-xl" />
          <div className="flex gap-2">
            <XMarkIcon className="w-6 h-6 cursor-pointer" onClick={onDelete} />
            <ArrowUpOnSquareIcon
              className="w-6 h-6 cursor-pointer"
              onClick={onDrawTopCard}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {handCards.map((id) => {
            let originalCard: OriginalCard;
            const card = cards[id];
            if (card.type === 'original') {
              originalCard = card;
            } else {
              originalCard = cards[card.parentId] as OriginalCard;
            }

            return (
              <CardTile
                id={id}
                key={id}
                originalCard={originalCard}
                onUpdate={(c) => onUpdateCard(c)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
