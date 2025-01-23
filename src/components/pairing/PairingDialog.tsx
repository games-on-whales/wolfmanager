import { useState, useEffect, ChangeEvent } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  SelectChangeEvent,
  IconButton,
  Tooltip
} from '@mui/material'
import { Refresh as RefreshIcon } from '@mui/icons-material'
import WolfService, { PairedClient } from '../../services/api/wolf'
import { ConfigService } from '../../services'
import Logger from '../../services/api/logs'

interface PairingDialogProps {
  open: boolean
  onClose: () => void
}

interface PendingRequest {
  pair_secret: string
  pin: string // This is the IP address
}

// Validate a single request object
function isValidRequest(request: any): request is PendingRequest {
  return (
    request &&
    typeof request === 'object' &&
    typeof request.pair_secret === 'string' &&
    request.pair_secret.length > 0 &&
    typeof request.pin === 'string' &&
    request.pin.length > 0 &&
    /^\d+\.\d+\.\d+\.\d+$/.test(request.pin) // Validate IP format
  )
}

export function PairingDialog({ open, onClose }: PairingDialogProps) {
  const [pinCode, setPinCode] = useState('')
  const [friendlyName, setFriendlyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const [selectedIP, setSelectedIP] = useState<string>('')
  const [refreshing, setRefreshing] = useState(false)

  const fetchPendingRequests = async () => {
    try {
      setRefreshing(true)
      setError(null)
      const response = await WolfService.getPendingPairRequests()
      
      // Validate the response and filter out invalid requests
      const validRequests = (response.requests || [])
        .filter(isValidRequest)
        // Remove duplicates based on IP
        .filter((request, index, self) => 
          index === self.findIndex(r => r.pin === request.pin)
        )

      setPendingRequests(validRequests)

      // Handle IP selection after updating requests
      if (validRequests.length === 0) {
        setSelectedIP('')
      } else {
        // If there's no current selection or the current selection is no longer valid
        const currentIPExists = validRequests.some(req => req.pin === selectedIP)
        if (!currentIPExists) {
          setSelectedIP(validRequests[0].pin)
        }
      }

      // Log any invalid or duplicate requests for debugging
      if (response.requests?.length !== validRequests.length) {
        console.warn('Some pairing requests were invalid or duplicated:', {
          original: response.requests,
          filtered: validRequests
        })
      }
    } catch (err) {
      console.error('Error fetching pending requests:', err)
      setError('Failed to fetch pending requests')
      setPendingRequests([])
      setSelectedIP('')
    } finally {
      setRefreshing(false)
    }
  }

  // Reset states when dialog opens/closes
  useEffect(() => {
    if (open) {
      // Reset states and fetch new data when dialog opens
      setPinCode('')
      setSelectedIP('')
      setError(null)
      setWarning(null)
      setSuccess(false)
      setPendingRequests([])
      fetchPendingRequests()
    }
  }, [open])

  const handlePairSubmit = async () => {
    try {
      setLoading(true)
      setError(null)
      setWarning(null)
      setSuccess(false)

      if (!selectedIP) {
        setError('Please select an IP address')
        return
      }

      if (!friendlyName.trim()) {
        setError('Please enter a friendly name for the client')
        return
      }

      const selectedRequest = pendingRequests.find((req: PendingRequest) => req.pin === selectedIP)
      if (!selectedRequest) {
        setError('Selected request not found')
        return
      }

      const confirmResponse = await WolfService.confirmPairing(selectedRequest.pair_secret, pinCode)
      
      if (confirmResponse.success) {
        // Get the current list of clients to find the new one
        try {
          Logger.debug('Fetching client list after successful pairing', 'PairingDialog')
          
          // Add retry mechanism
          let retryCount = 0
          let clientsData
          
          while (retryCount < 3) {
            // Wait for a short delay before fetching
            await new Promise(resolve => setTimeout(resolve, 1000))
            
            clientsData = await WolfService.getClients()
            Logger.debug('Received client list', 'PairingDialog', { 
              clientsData, 
              attempt: retryCount + 1,
              rawClientIds: clientsData.clients.map(c => ({
                original: c.client_id,
                asBigInt: BigInt(c.client_id).toString(),
                asString: c.client_id.toString()
              }))
            })
            
            if (clientsData.success && clientsData.clients && clientsData.clients.length > 0) {
              // Check for duplicate client IDs
              const clientIds = clientsData.clients.map(client => ({
                original: client.client_id,
                asBigInt: BigInt(client.client_id).toString(),
                asString: client.client_id.toString()
              }))
              const uniqueClientIds = new Set(clientIds.map(c => c.asBigInt))
              
              if (clientIds.length !== uniqueClientIds.size) {
                const duplicates = clientIds.filter((id, index) => clientIds.indexOf(id) !== index)
                Logger.warn('Duplicate client IDs detected in Wolf config', 'PairingDialog', {
                  duplicateIds: duplicates,
                  totalClients: clientIds.length,
                  uniqueClients: uniqueClientIds.size
                })
                // Show warning but continue with pairing
                setWarning('Duplicate client IDs detected in Wolf configuration. Please check your Wolf config file after pairing completes.')
              }
              break
            }
            
            retryCount++
            if (retryCount < 3) {
              Logger.debug('Retrying client list fetch', 'PairingDialog', { attempt: retryCount + 1 })
            }
          }
          
          if (!clientsData || !clientsData.success || !clientsData.clients || clientsData.clients.length === 0) {
            Logger.error('Failed to get client list after retries', 'PairingDialog', JSON.stringify({ attempts: retryCount + 1 }))
            setError('Failed to get client list after multiple attempts')
            return
          }
          
          // Get current config
          const config = ConfigService.getConfig()
          const currentUser = config.currentUser
          
          if (currentUser) {
            const userConfig = config.users[currentUser]
            const clients = userConfig.clients || {}
            Logger.debug('Current client list', 'PairingDialog', clients)
            
            // Find the new client (the one not in our current list)
            const newClient: PairedClient = clientsData.clients[clientsData.clients.length - 1]
            Logger.debug('Using last client from list as new client', 'PairingDialog', { 
              newClient,
              totalClients: clientsData.clients.length
            })
            
            if (newClient) {
              const clientId = BigInt(newClient.client_id).toString()
              const updatedClients = {
                ...clients,
                [clientId]: {
                  friendlyName: friendlyName.trim()
                }
              }
              Logger.debug('Updating config with new client', 'PairingDialog', updatedClients)
              
              // Update the config with the new client
              await ConfigService.editUser(
                currentUser,
                undefined,  // Don't update steamId
                undefined,  // Don't update steamApiKey
                updatedClients
              )
              
              setSuccess(true)
              // Give time for the success message to be seen
              setTimeout(() => {
                onClose()
              }, 2000)
            } else {
              Logger.error('Could not find newly paired client', 'PairingDialog')
              setError('Could not find newly paired client')
            }
          } else {
            Logger.error('No active user found', 'PairingDialog')
            setError('No active user found')
          }
        } catch (err) {
          Logger.error('Error updating client config', err, 'PairingDialog')
          console.error('Error updating client config:', err)
          setError('Failed to update client configuration')
        }
      } else {
        Logger.error('Failed to confirm pairing: ' + JSON.stringify(confirmResponse), 'PairingDialog')
        setError('Failed to confirm pairing, please try again')
      }
    } catch (err) {
      console.error('Error during pairing:', err)
      setError('Failed to confirm pairing, please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    await fetchPendingRequests()
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Pair client</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {warning && <Alert severity="warning" sx={{ mb: 2 }}>{warning}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>Successfully paired with client!</Alert>}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Select Client IP</InputLabel>
              <Select
                value={selectedIP}
                label="Select Client IP"
                onChange={(e: SelectChangeEvent) => setSelectedIP(e.target.value)}
                disabled={loading || success || pendingRequests.length === 0 || refreshing}
              >
                {pendingRequests.map((request: PendingRequest) => (
                  <MenuItem key={request.pin} value={request.pin}>
                    {request.pin}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="Refresh pending requests">
              <span>
                <IconButton 
                  onClick={handleRefresh} 
                  disabled={loading || success || refreshing}
                  sx={{ mb: 1 }}
                >
                  {refreshing ? <CircularProgress size={24} /> : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          <TextField
            margin="dense"
            label="Friendly Name"
            type="text"
            fullWidth
            value={friendlyName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFriendlyName(e.target.value)}
            disabled={loading || success || !selectedIP || refreshing}
          />
          <TextField
            margin="dense"
            label="Enter PIN"
            type="text"
            fullWidth
            value={pinCode}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPinCode(e.target.value)}
            disabled={loading || success || !selectedIP || refreshing}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading || refreshing}>Cancel</Button>
        <Button 
          onClick={handlePairSubmit} 
          disabled={!pinCode || !selectedIP || !friendlyName.trim() || loading || success || refreshing}
          variant="contained"
        >
          {loading ? <CircularProgress size={24} /> : 'Pair'}
        </Button>
      </DialogActions>
    </Dialog>
  )
} 