'use client'

import { useState, useEffect } from 'react'
import { PeriodSetting } from '@/lib/types'
import { getPeriods } from '@/lib/supabase/queries'

export function usePeriods() {
  const [periods, setPeriods] = useState<PeriodSetting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPeriods()
      .then(setPeriods)
      .finally(() => setLoading(false))
  }, [])

  return { periods, setPeriods, loading }
}
