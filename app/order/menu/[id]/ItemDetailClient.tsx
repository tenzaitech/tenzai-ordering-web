'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import optionGroupsData from '@/data/option_groups.json'
import { useCart, CartItemOption } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { triggerHaptic } from '@/utils/haptic'
import Toast from '@/components/Toast'

type OptionChoice = {
  id: string
  name_th: string
  name_en: string
  price_delta_thb: number
}

type OptionGroup = {
  id: string
  name_th: string
  name_en: string
  type: 'single' | 'multi'
  required: boolean
  min?: number
  max?: number
  choices: OptionChoice[]
  default_choice_ids?: string[]
}

type MenuItem = {
  id: string
  name_th: string
  name_en: string
  category: string
  price_thb: number
  image: string
  is_sold_out: boolean
  subtitle?: string
  option_group_ids?: string[]
}

interface ItemDetailClientProps {
  menuItem: MenuItem
}

export default function ItemDetailClient({ menuItem }: ItemDetailClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addItem, updateItem, items } = useCart()
  const { language } = useLanguage()
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
  const [note, setNote] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [showToast, setShowToast] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [navDirection, setNavDirection] = useState<'forward' | 'backward'>('forward')

  const editId = searchParams.get('edit')
  const isEditMode = !!editId
  const cartItem = isEditMode ? items.find(item => item.id === editId) : null

  useEffect(() => {
    const direction = sessionStorage.getItem('navigationDirection') as 'forward' | 'backward' || 'forward'
    sessionStorage.removeItem('navigationDirection')
    setNavDirection(direction)
    setMounted(true)
  }, [])

  if (isEditMode && !cartItem) {
    router.push('/order/cart')
    return <div>Loading...</div>
  }

  const optionGroups: OptionGroup[] = (menuItem.option_group_ids || [])
    .map(groupId => (optionGroupsData as OptionGroup[]).find(g => g.id === groupId))
    .filter((g): g is OptionGroup => g !== undefined)

  useEffect(() => {
    if (isEditMode && cartItem) {
      const editSelections: Record<string, string[]> = {}

      optionGroups.forEach(group => {
        editSelections[group.id] = []
      })

      if (cartItem.options) {
        cartItem.options.forEach((option: CartItemOption) => {
          editSelections[option.group_id] = [...option.choice_ids]
        })
      }

      setSelectedOptions(editSelections)
      setNote(cartItem.note || '')
      setQuantity(cartItem.quantity || 1)
    } else {
      const initialSelections: Record<string, string[]> = {}
      optionGroups.forEach(group => {
        if (group.default_choice_ids && group.default_choice_ids.length > 0) {
          initialSelections[group.id] = [...group.default_choice_ids]
        } else if (group.type === 'single' && group.required) {
          initialSelections[group.id] = []
        } else {
          initialSelections[group.id] = []
        }
      })
      setSelectedOptions(initialSelections)
      setNote('')
      setQuantity(1)
    }
  }, [menuItem.id, isEditMode, editId])

  const handleOptionChange = (groupId: string, choiceId: string, group: OptionGroup) => {
    if (group.type === 'single') {
      setSelectedOptions(prev => ({
        ...prev,
        [groupId]: [choiceId]
      }))
    } else {
      setSelectedOptions(prev => {
        const current = prev[groupId] || []
        const isSelected = current.includes(choiceId)

        if (isSelected) {
          return {
            ...prev,
            [groupId]: current.filter(id => id !== choiceId)
          }
        } else {
          const max = group.max || 999
          if (current.length >= max) {
            return prev
          }
          return {
            ...prev,
            [groupId]: [...current, choiceId]
          }
        }
      })
    }
    setValidationErrors(prev => {
      const { [groupId]: _, ...rest } = prev
      return rest
    })
  }

  const calculateTotalPrice = () => {
    let total = menuItem.price_thb

    optionGroups.forEach(group => {
      const selectedIds = selectedOptions[group.id] || []
      selectedIds.forEach(choiceId => {
        const choice = group.choices.find(c => c.id === choiceId)
        if (choice) {
          total += choice.price_delta_thb
        }
      })
    })

    return total
  }

  const handleAddToCart = () => {
    if (!isFormValid()) {
      const errors: Record<string, string> = {}
      optionGroups.forEach(group => {
        const selectedIds = selectedOptions[group.id] || []
        if (group.required && group.type === 'single' && selectedIds.length === 0) {
          errors[group.id] = language === 'th' ? 'กรุณาเลือก' : 'Please select'
        } else if (group.required && group.type === 'multi') {
          const min = group.min || 1
          if (selectedIds.length < min) {
            errors[group.id] = language === 'th' ? `กรุณาเลือกอย่างน้อย ${min}` : `Select at least ${min}`
          }
        }
      })
      setValidationErrors(errors)
      return
    }

    const cartOptions = optionGroups
      .filter(group => {
        const selectedIds = selectedOptions[group.id] || []
        return selectedIds.length > 0
      })
      .map(group => {
        const selectedIds = selectedOptions[group.id] || []
        const choiceNamesTh: string[] = []
        const choiceNamesEn: string[] = []
        let priceDelta = 0

        selectedIds.forEach(choiceId => {
          const choice = group.choices.find(c => c.id === choiceId)
          if (choice) {
            choiceNamesTh.push(choice.name_th)
            choiceNamesEn.push(choice.name_en)
            priceDelta += choice.price_delta_thb
          }
        })

        return {
          group_id: group.id,
          group_name_th: group.name_th,
          group_name_en: group.name_en,
          choice_ids: selectedIds,
          choice_names_th: choiceNamesTh,
          choice_names_en: choiceNamesEn,
          price_delta_thb: priceDelta
        }
      })

    const finalPrice = calculateTotalPrice()

    triggerHaptic()

    if (isEditMode && cartItem) {
      updateItem(cartItem.id, {
        quantity: quantity,
        options: cartOptions.length > 0 ? cartOptions : undefined,
        note: note.trim() || undefined,
        final_price_thb: finalPrice
      })
      setShowToast(true)
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('navigationDirection', 'backward')
        }
        router.push('/order/cart')
      }, 150)
    } else {
      addItem({
        menuId: menuItem.id,
        name_th: menuItem.name_th,
        name_en: menuItem.name_en,
        base_price_thb: menuItem.price_thb,
        final_price_thb: finalPrice,
        quantity: quantity,
        options: cartOptions.length > 0 ? cartOptions : undefined,
        note: note.trim() || undefined
      })
      setShowToast(true)
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('navigationDirection', 'backward')
        }
        router.push('/order/menu')
      }, 150)
    }
  }

  const isFormValid = () => {
    return optionGroups.every(group => {
      const selectedIds = selectedOptions[group.id] || []

      if (group.required) {
        if (group.type === 'single') {
          return selectedIds.length > 0
        } else if (group.type === 'multi') {
          const min = group.min || 1
          return selectedIds.length >= min
        }
      }
      return true
    })
  }

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => {
      const newQty = prev + delta
      return newQty < 1 ? 1 : newQty
    })
    triggerHaptic()
  }

  return (
    <div className={`min-h-screen bg-bg ${navDirection === 'forward' ? 'page-transition-forward' : 'page-transition-backward'} ${mounted ? 'page-mounted' : ''}`}>
      {showToast && (
        <Toast
          message={isEditMode
            ? (language === 'th' ? 'แก้ไขรายการแล้ว' : 'Item updated')
            : (language === 'th' ? 'เพิ่มลงตะกร้าแล้ว' : 'Added to cart')
          }
          onClose={() => setShowToast(false)}
        />
      )}
      <div className="max-w-mobile mx-auto">
        <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border flex items-center">
          <button
            onClick={() => {
              triggerHaptic()
              setTimeout(() => {
                if (typeof window !== 'undefined') {
                  sessionStorage.setItem('navigationDirection', 'backward')
                }
                router.push(isEditMode ? "/order/cart" : "/order/menu")
              }, 120)
            }}
            className="text-muted hover:text-text active:text-text transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-medium flex-1 text-center mr-6 text-text">
            {isEditMode ? 'Edit Item' : 'Item Details'}
          </h1>
        </header>

        <div className="pb-24">
          <div className="relative h-64 bg-border">
            <div className="absolute inset-0 flex items-center justify-center text-muted">
              <span>Image Placeholder</span>
            </div>
          </div>

          <div className="px-5 py-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-medium text-text">{menuItem.name_en}</h2>
                <p className="text-lg text-muted">{menuItem.name_th}</p>
                {menuItem.subtitle && (
                  <p className="text-sm text-muted mt-1">{menuItem.subtitle}</p>
                )}
              </div>
              <p className="text-2xl font-semibold text-primary">฿{calculateTotalPrice()}</p>
            </div>

            {optionGroups.map(group => {
              const selectedIds = selectedOptions[group.id] || []
              const groupName = language === 'th' ? group.name_th : group.name_en

              return (
                <div key={group.id} className="mb-6">
                  <h3 className="text-lg font-medium mb-3 text-text">
                    {groupName}
                    {group.required && <span className="text-primary ml-1">*</span>}
                  </h3>
                  {validationErrors[group.id] && (
                    <p className="text-sm text-primary mb-2">{validationErrors[group.id]}</p>
                  )}
                  <div className="space-y-2">
                    {group.choices.map(choice => {
                      const choiceName = language === 'th' ? choice.name_th : choice.name_en
                      const isChecked = selectedIds.includes(choice.id)

                      return (
                        <label
                          key={choice.id}
                          className="flex items-center justify-between p-3 bg-card border border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors"
                        >
                          <div className="flex items-center">
                            <input
                              type={group.type === 'single' ? 'radio' : 'checkbox'}
                              name={group.id}
                              checked={isChecked}
                              onChange={() => handleOptionChange(group.id, choice.id, group)}
                              className="mr-3 w-4 h-4 accent-primary focus:ring-primary"
                            />
                            <span className="text-text">{choiceName}</span>
                          </div>
                          {choice.price_delta_thb > 0 && (
                            <span className="text-primary font-medium">+฿{choice.price_delta_thb}</span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className="mb-6">
              <h3 className="text-lg font-medium mb-3 text-text">Special Instructions</h3>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add any special requests here (optional)"
                className="w-full p-3 bg-card border border-border text-text placeholder:text-muted rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
          <div className="max-w-mobile mx-auto p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-text font-medium">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={!isFormValid() || quantity <= 1}
                  className="w-10 h-10 flex items-center justify-center bg-card border border-border rounded-lg text-text font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 transition-colors active:bg-border"
                >
                  −
                </button>
                <span className="text-text font-medium text-lg w-8 text-center">{quantity}</span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  disabled={!isFormValid()}
                  className="w-10 h-10 flex items-center justify-center bg-card border border-border rounded-lg text-text font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 transition-colors active:bg-border"
                >
                  +
                </button>
              </div>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!isFormValid()}
              className="w-full py-4 bg-primary text-white font-medium rounded-lg disabled:bg-border disabled:text-muted disabled:cursor-not-allowed transition-all active:scale-[0.98] active:bg-primary/90"
            >
              {isEditMode ? 'Save Changes' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
