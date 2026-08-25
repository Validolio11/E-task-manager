import EmojiPicker, { Categories, EmojiStyle, SkinTonePickerLocation, Theme, type EmojiClickData } from "emoji-picker-react";
import ukEmojiData from "emoji-picker-react/dist/data/emojis-uk";

export default function EmojiCatalog({ onSelect }: { onSelect: (emoji: string) => void }) {
  const selectEmoji = (data: EmojiClickData) => onSelect(data.emoji);

  return <div className="emoji-catalog" aria-label="Каталог усіх емоджі">
    <EmojiPicker
      autoFocusSearch={false}
      categories={[
        { category: Categories.SUGGESTED, name: "Нещодавні" },
        { category: Categories.SMILEYS_PEOPLE, name: "Смайли та люди" },
        { category: Categories.ANIMALS_NATURE, name: "Тварини та природа" },
        { category: Categories.FOOD_DRINK, name: "Їжа та напої" },
        { category: Categories.TRAVEL_PLACES, name: "Подорожі та місця" },
        { category: Categories.ACTIVITIES, name: "Активності" },
        { category: Categories.OBJECTS, name: "Предмети" },
        { category: Categories.SYMBOLS, name: "Символи" },
        { category: Categories.FLAGS, name: "Прапори" },
      ]}
      emojiData={ukEmojiData}
      emojiStyle={EmojiStyle.NATIVE}
      height="var(--emoji-picker-height)"
      lazyLoadEmojis
      onEmojiClick={selectEmoji}
      previewConfig={{ showPreview: false }}
      searchClearButtonLabel="Очистити"
      searchPlaceholder="Пошук емоджі"
      skinTonePickerLocation={SkinTonePickerLocation.SEARCH}
      theme={Theme.LIGHT}
      width="100%"
    />
  </div>;
}
