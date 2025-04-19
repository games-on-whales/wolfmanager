"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"

interface PinInputProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

export default function PinInput({ value, onChange, maxLength = 4 }: PinInputProps) {
  const [pins, setPins] = useState<string[]>(Array(maxLength).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Initialize refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, maxLength)
  }, [maxLength])

  // Update pins when value changes externally
  useEffect(() => {
    if (value) {
      const valueArray = value.split("").slice(0, maxLength)
      const newPins = Array(maxLength).fill("")
      valueArray.forEach((char, index) => {
        newPins[index] = char
      })
      setPins(newPins)
    } else {
      setPins(Array(maxLength).fill(""))
    }
  }, [value, maxLength])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newValue = e.target.value

    // Only allow numbers
    if (newValue && !/^\d*$/.test(newValue)) {
      return
    }

    // Take only the last character if multiple are pasted
    const digit = newValue.slice(-1)

    // Update the pins array
    const newPins = [...pins]
    newPins[index] = digit
    setPins(newPins)

    // Call the onChange prop with the new combined value
    onChange(newPins.join(""))

    // Auto-advance to next input if a digit was entered
    if (digit && index < maxLength - 1) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Move to previous input on backspace if current input is empty
    if (e.key === "Backspace" && !pins[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }

    // Move to next input on right arrow
    if (e.key === "ArrowRight" && index < maxLength - 1) {
      inputRefs.current[index + 1]?.focus()
    }

    // Move to previous input on left arrow
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text/plain").trim()

    // Only allow numbers
    if (!/^\d*$/.test(pastedData)) {
      return
    }

    const digits = pastedData.slice(0, maxLength).split("")
    const newPins = [...pins]

    digits.forEach((digit, idx) => {
      if (idx < maxLength) {
        newPins[idx] = digit
      }
    })

    setPins(newPins)
    onChange(newPins.join(""))

    // Focus the next empty input or the last input
    const nextEmptyIndex = newPins.findIndex((p) => !p)
    if (nextEmptyIndex !== -1 && nextEmptyIndex < maxLength) {
      inputRefs.current[nextEmptyIndex]?.focus()
    } else {
      inputRefs.current[maxLength - 1]?.focus()
    }
  }

  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: maxLength }).map((_, index) => (
        <Input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={pins[index]}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          className="w-14 h-14 text-center text-xl font-bold bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.1)] text-white neon-border focus:border-[#01cdfe] focus:ring-[#01cdfe]"
        />
      ))}
    </div>
  )
}
