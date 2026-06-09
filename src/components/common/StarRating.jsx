export default function StarRating({ value = 0, onChange, readonly = false }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => !readonly && onChange && onChange(star === value ? 0 : star)}
          className={`text-2xl transition-transform ${readonly ? 'cursor-default' : 'hover:scale-110 cursor-pointer'} ${star <= value ? 'star-filled' : 'star-empty'}`}
          disabled={readonly}
        >
          ★
        </button>
      ))}
    </div>
  )
}
