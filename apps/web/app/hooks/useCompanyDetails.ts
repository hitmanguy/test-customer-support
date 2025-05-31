import { useQuery } from '@tanstack/react-query';
import { trpc } from '@web/app/trpc/client';
import type { Company } from '@web/app/types/types';

export function useCompanyDetails(companyId: string) {

  const { data: companyData, isLoading } = trpc.utils.getCompany.useQuery({ companyId });
 
  return {
    company: companyData?.company as Company | undefined,
    isLoading
  };
}