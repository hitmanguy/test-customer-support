'use client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { trpc } from './trpc/client';
import { useEffect } from 'react';

export function ClientGreeting() {
  const { data } = trpc.hello.useQuery({name : "gnan"});
  if(!data){
    return <div>No data</div>;
  }

  return <div>{data.greeting}</div>;
}