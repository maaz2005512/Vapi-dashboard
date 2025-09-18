import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { CallWithDetails, UseCallsReturn, CallsChartDataPoint, CallSummary } from './types'

export function useCalls(): UseCallsReturn {
  const supabase = useMemo(() => createClient(), [])
  const { user } = useAuth()

  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingByAgent, setIsLoadingByAgent] = useState(false)
  const [isLoadingChart, setIsLoadingChart] = useState(false)
  const [allCalls, setAllCalls] = useState<CallWithDetails[]>([])
  const [callsById, setCallsById] = useState<Record<string, CallWithDetails[]>>({})
  const [chartData, setChartData] = useState<CallsChartDataPoint[]>([])
  const [error, setError] = useState<string | null>(null)

  // Load all calls
  const loadAllCalls = useCallback(async () => {
    if (!user) {
      setAllCalls([])
      setError(null)
      return
    }

    try {
      setError(null)

      const { data, error: queryError } = await supabase
        .from('calls')
        .select(`
          id,
          call_uuid,
          user_id,
          agent_id,
          duration,
          cost,
          transcript,
          recording_url,
          created_at,
          agents!inner (
            id,
            name,
            platform_name,
            company_id,
            client_id,
            clients (
              id,
              name
            ),
            companies (
              id,
              name
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (queryError) {
        setError(queryError.message)
        setAllCalls([])
        return
      }

      const formattedData: CallWithDetails[] = (data || []).map(item => ({
        id: item.id,
        call_uuid: item.call_uuid,
        user_id: item.user_id,
        agent_id: item.agent_id,
        duration: item.duration ?? 0,
        cost: item.cost ?? 0,
        transcript: item.transcript ?? null,
        recording_url: item.recording_url ?? null,
        created_at: item.created_at,

        // joined agent/company/client info
        agent_name: item.agents?.name ?? 'Unknown Agent',
        agent_platform_name: item.agents?.platform_name ?? null,
        company_id: item.agents?.company_id ?? null,
        client_id: item.agents?.client_id ?? null,
        client_name: item.agents?.clients?.name ?? null,
        company_name: item.agents?.companies?.name ?? null
      }))

      setAllCalls(formattedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setAllCalls([])
    }
  }, [supabase, user])

  // Chart data (calls per day by agent)
  const getChartData = useCallback(async (limit: number = 5, days: number = 30): Promise<CallsChartDataPoint[]> => {
    if (!user) return []

    try {
      setIsLoadingChart(true)
      setError(null)

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      const { data, error: queryError } = await supabase
        .from('calls')
        .select(`
          created_at,
          agents!inner (
            name
          )
        `)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: true })

      if (queryError) {
        setError(queryError.message)
        return []
      }

      const agentCounts: Record<string, number> = {}
      data?.forEach(item => {
        const agentName = item.agents?.name ?? 'Unknown Agent'
        agentCounts[agentName] = (agentCounts[agentName] || 0) + 1
      })

      const topAgents = Object.entries(agentCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit)
        .map(([name]) => name)

      const dateGroups: Record<string, Record<string, number>> = {}
      data?.forEach(item => {
        const agentName = item.agents?.name ?? 'Unknown Agent'
        if (!topAgents.includes(agentName)) return

        const date = new Date(item.created_at).toISOString().split('T')[0]
        if (!dateGroups[date]) dateGroups[date] = {}
        dateGroups[date][agentName] = (dateGroups[date][agentName] || 0) + 1
      })

      const chartData: CallsChartDataPoint[] = Object.entries(dateGroups)
        .map(([date, agents]) => ({ date, ...agents }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      setChartData(chartData)
      return chartData
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      return []
    } finally {
      setIsLoadingChart(false)
    }
  }, [supabase, user])

  // Get calls by agent id
  const getCallsByAgentId = useCallback(async (agentId: string): Promise<CallWithDetails[]> => {
    if (!user || !agentId) return []

    try {
      setIsLoadingByAgent(true)
      setError(null)

      if (callsById[agentId]) return callsById[agentId]

      const { data, error: queryError } = await supabase
        .from('calls')
        .select(`
          id,
          call_uuid,
          user_id,
          agent_id,
          duration,
          cost,
          transcript,
          recording_url,
          created_at,
          agents!inner (
            id,
            name,
            platform_name,
            company_id,
            client_id,
            clients (
              id,
              name
            ),
            companies (
              id,
              name
            )
          )
        `)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })

      if (queryError) {
        setError(queryError.message)
        return []
      }

      const formattedData: CallWithDetails[] = (data || []).map(item => ({
        id: item.id,
        call_uuid: item.call_uuid,
        user_id: item.user_id,
        agent_id: item.agent_id,
        duration: item.duration ?? 0,
        cost: item.cost ?? 0,
        transcript: item.transcript ?? null,
        recording_url: item.recording_url ?? null,
        created_at: item.created_at,

        agent_name: item.agents?.name ?? 'Unknown Agent',
        agent_platform_name: item.agents?.platform_name ?? null,
        company_id: item.agents?.company_id ?? null,
        client_id: item.agents?.client_id ?? null,
        client_name: item.agents?.clients?.name ?? null,
        company_name: item.agents?.companies?.name ?? null
      }))

      setCallsById(prev => ({ ...prev, [agentId]: formattedData }))
      return formattedData
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      return []
    } finally {
      setIsLoadingByAgent(false)
    }
  }, [supabase, user, callsById])

  // Get single call by ID
  const getCallById = useCallback(async (callId: string): Promise<CallWithDetails | null> => {
    if (!user || !callId) return null

    try {
      setError(null)

      const existingCall = allCalls.find(call => call.id === callId)
      if (existingCall) return existingCall

      const { data, error: queryError } = await supabase
        .from('calls')
        .select(`
          id,
          call_uuid,
          user_id,
          agent_id,
          duration,
          cost,
          transcript,
          recording_url,
          created_at,
          agents!inner (
            id,
            name,
            platform_name,
            company_id,
            client_id,
            clients (
              id,
              name
            ),
            companies (
              id,
              name
            )
          )
        `)
        .eq('id', callId)
        .single()

      if (queryError) {
        setError(queryError.message)
        return null
      }

      return {
        id: data.id,
        call_uuid: data.call_uuid,
        user_id: data.user_id,
        agent_id: data.agent_id,
        duration: data.duration ?? 0,
        cost: data.cost ?? 0,
        transcript: data.transcript ?? null,
        recording_url: data.recording_url ?? null,
        created_at: data.created_at,

        agent_name: data.agents?.name ?? 'Unknown Agent',
        agent_platform_name: data.agents?.platform_name ?? null,
        company_id: data.agents?.company_id ?? null,
        client_id: data.agents?.client_id ?? null,
        client_name: data.agents?.clients?.name ?? null,
        company_name: data.agents?.companies?.name ?? null
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      return null
    }
  }, [supabase, user, allCalls])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      setCallsById({})
      await loadAllCalls()
    } finally {
      setIsLoading(false)
    }
  }, [loadAllCalls])

  // Computed values
  const totalCalls = useMemo(() => allCalls.length, [allCalls])
  const totalCost = useMemo(() => allCalls.reduce((sum, call) => sum + (Number(call.cost) || 0), 0), [allCalls])
  const totalDuration = useMemo(() => allCalls.reduce((sum, call) => sum + (call.duration || 0), 0), [allCalls])
  const agentCount = useMemo(() => new Set(allCalls.map(call => call.agent_id)).size, [allCalls])

  const summary = useMemo((): CallSummary => {
    if (allCalls.length === 0) {
      return {
        total_calls: 0,
        total_duration_seconds: 0,
        total_cost_cents: 0,
        avg_duration_seconds: 0,
        avg_cost_cents: 0,
        success_rate: 0,
        by_type: {},
        by_status: {}
      }
    }

    return {
      total_calls: allCalls.length,
      total_duration_seconds: totalDuration,
      total_cost_cents: totalCost,
      avg_duration_seconds: Math.round(totalDuration / allCalls.length),
      avg_cost_cents: Math.round(totalCost / allCalls.length),
      success_rate: 0, // adjust if you track status later
      by_type: {},
      by_status: {}
    }
  }, [allCalls, totalDuration, totalCost])

  // Load data on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        await loadAllCalls()
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [loadAllCalls])

  return {
    isLoading,
    isLoadingByAgent,
    isLoadingChart,
    allCalls,
    callsById,
    chartData,
    summary,
    refresh,
    getCallsByAgentId,
    getChartData,
    getCallById,
    totalCalls,
    totalCost,
    totalDuration,
    agentCount,
    error
  }
}

export default useCalls
