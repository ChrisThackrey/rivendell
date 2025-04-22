import { useState, useEffect, useCallback, useRef } from "react"
import {
  MonteCarloDataPoint,
  MonteCarloCluster,
  fetchAvailableBatchIds,
  fetchMonteCarloDataForBatch,
  generateClusters,
  generateClusterTitles,
  PointWithCluster, // Assuming this type alias is needed or defined in the service
} from "@/lib/monte-carlo-service"
import { normalizeAndSpreadPoints, addJitterToPoints } from "../utils"

const DEBUG = process.env.NODE_ENV !== 'production'

export function useMonteCarloData(initialBatchId?: string | null) {
  const isMounted = useRef(true)
  const [data, setData] = useState<PointWithCluster[]>([])
  const [clusters, setClusters] = useState<MonteCarloCluster[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [allBatchIds, setAllBatchIds] = useState<string[]>([])
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(initialBatchId || null)
  const [isFetchingBatches, setIsFetchingBatches] = useState(false)

  // Effect to handle component mount/unmount for async operations
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Fetch available batch IDs
  const fetchBatchIds = useCallback(async () => {
    if (DEBUG) console.debug("Fetching available batch IDs...")
    setIsFetchingBatches(true)
    try {
      const batchIds = await fetchAvailableBatchIds()
      if (!isMounted.current) return
      if (DEBUG) console.debug(`Fetched ${batchIds.length} batch IDs`)
      if (batchIds.length > 0) {
        const sortedBatchIds = [...batchIds].sort((a, b) => {
          const getTimestamp = (id: string) => {
            const match = id.match(/batch_(\d+)/)
            return match ? parseInt(match[1]) : 0
          }
          const timeA = getTimestamp(a)
          const timeB = getTimestamp(b)
          return timeB - timeA
        })
        setAllBatchIds(sortedBatchIds)
      } else {
        if (DEBUG) console.debug("No batch IDs found")
        setAllBatchIds([])
      }
    } catch (error) {
      console.warn("Error fetching batch IDs:", error)
      if (!isMounted.current) return
      setAllBatchIds([])
    } finally {
      if (isMounted.current) setIsFetchingBatches(false)
    }
  }, []) // No dependencies needed as it relies on isMounted ref

  // Fetch batch IDs on component mount
  useEffect(() => {
    fetchBatchIds()
  }, [fetchBatchIds])

  // Handler for changing the selected batch
  const handleBatchChange = useCallback(async (value: string) => {
    setSelectedBatchId(value)
    setIsLoading(true)
    setData([]) // Clear previous data immediately
    setClusters([])

    // Don't necessarily need to refetch all batch IDs here unless the list might change often
    // await fetchBatchIds(); // Optional: uncomment if needed

    try {
      if (!isMounted.current) return
      if (DEBUG) console.debug(`Loading data for batch ${value}...`)
      const { dataPoints } = await fetchMonteCarloDataForBatch(value)
      if (!isMounted.current) return

      if (dataPoints.length === 0) {
        if (DEBUG) console.debug(`No data found for batch ${value}`)
        // Data/Clusters already cleared, just stop loading
        if (isMounted.current) setIsLoading(false)
        return
      }

      if (DEBUG) console.debug(`Processing ${dataPoints.length} points...`)
      const spreadPoints = normalizeAndSpreadPoints(dataPoints)
      const processedPoints = addJitterToPoints(spreadPoints)

      if (DEBUG) console.debug(`Generating clusters for ${processedPoints.length} points...`)
      const generatedClusters = await generateClusters(processedPoints)
      if (!isMounted.current) return

      if (DEBUG) console.debug(`Assigning ${generatedClusters.length} clusters to data points...`)
      const dataWithClusters: PointWithCluster[] = processedPoints.map((point) => {
        const cluster = generatedClusters.find((c) => c.points.some((p) => p.id === point.id))
        return { ...point, cluster: cluster?.id }
      })

      if (DEBUG) console.debug(`Generating titles for clusters...`)
      const clustersWithTitles = await generateClusterTitles(generatedClusters)
      if (!isMounted.current) return

      if (DEBUG) console.debug(`Updating state with ${dataWithClusters.length} points and ${clustersWithTitles.length} clusters`)
      if (isMounted.current) {
        setData(dataWithClusters)
        setClusters(clustersWithTitles)
      }
    } catch (error) {
      console.error(`Error fetching data for batch ${value}:`, error)
      if (isMounted.current) {
        setData([])
        setClusters([])
      }
    } finally {
      if (isMounted.current) setIsLoading(false)
    }
  }, [fetchBatchIds]) // Dependency on fetchBatchIds is okay here if needed

  // Effect to load data when selectedBatchId changes initially or via handleBatchChange
  useEffect(() => {
    if (!selectedBatchId) {
      // Clear data if no batch is selected
      setData([])
      setClusters([])
      setIsLoading(false) // Set loading to false if no batch is selected
      return
    }

    // Use a local mounted flag specific to this effect instance
    let localMounted = true
    const loadData = async () => {
      if (!localMounted) return
      setIsLoading(true)
      try {
        // Fetch Monte Carlo data for the selected batch
        const { dataPoints } = await fetchMonteCarloDataForBatch(selectedBatchId)
        if (!localMounted) return

        if (dataPoints.length === 0) {
          if (DEBUG) console.log(`No data found for batch ${selectedBatchId}, showing empty state`)
          if (localMounted) {
            setData([])
            setClusters([])
            setIsLoading(false)
          }
          return
        }

        if (DEBUG) console.log(`Loaded ${dataPoints.length} points for 3D visualization`)
        const spreadPoints = normalizeAndSpreadPoints(dataPoints)
        const processedPoints = addJitterToPoints(spreadPoints)
        const generatedClusters = await generateClusters(processedPoints)
        if (!localMounted) return

        const dataWithClusters: PointWithCluster[] = processedPoints.map((point) => {
          const cluster = generatedClusters.find((c) => c.points.some((p) => p.id === point.id))
          return { ...point, cluster: cluster?.id }
        })

        const clustersWithTitles = await generateClusterTitles(generatedClusters)
        if (!localMounted) return

        if (localMounted) {
          setData(dataWithClusters)
          setClusters(clustersWithTitles)
        }
      } catch (error) {
        console.error("Error loading Monte Carlo data:", error)
        if (localMounted) {
          setData([])
          setClusters([])
        }
      } finally {
        if (localMounted) setIsLoading(false)
      }
    }

    loadData()

    return () => {
      localMounted = false // Cleanup for this specific effect run
    }
  }, [selectedBatchId]) // Re-run only when selectedBatchId changes

  return {
    data,
    clusters,
    isLoading,
    allBatchIds,
    selectedBatchId,
    handleBatchChange,
    isFetchingBatches,
    // Also return setData/setClusters if needed externally, though handleBatchChange covers most cases
  }
} 