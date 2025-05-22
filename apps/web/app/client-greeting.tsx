'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useTRPC } from './trpc/client';
import { useEffect } from 'react';

export function ClientGreeting() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.hello.queryOptions({name : "gnan"}));

  return <div>{data.greeting}</div>;
}