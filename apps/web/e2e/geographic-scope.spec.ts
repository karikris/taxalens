import { expect, test, type Locator } from '@playwright/test'

test('keeps artifact-derived geographic controls, camera and history synchronized', async ({ page }) => {
  await page.goto('./#dashboard')

  const continent = page.getByRole('combobox', { name: 'Continent' })
  const country = page.getByRole('combobox', { name: 'Country' })
  const map = page.locator('.taxalens-world-map__canvas')
  const breadcrumb = page.getByRole('navigation', { name: 'Geographic breadcrumb' })

  await expect.poll(() => continent.locator('option').count()).toBeGreaterThanOrEqual(2)
  const continents = (await selectOptions(continent)).filter(({ value }) => value !== 'global')
  expect(continents.length).toBeGreaterThanOrEqual(2)
  const firstContinent = continents[0]!
  const secondContinent = continents[1]!
  await continent.selectOption(firstContinent.value)
  await expect(map).toHaveAttribute('data-camera-scope', firstContinent.value, { timeout: 30_000 })
  await expect.poll(() => country.locator('option').count()).toBeGreaterThanOrEqual(2)
  const firstCountries = (await selectOptions(country)).filter(
    ({ value }) => value !== firstContinent.value,
  )
  expect(firstCountries.length).toBeGreaterThan(0)
  const firstCountry = firstCountries[0]!
  await country.selectOption(firstCountry.value)
  await expect(page).toHaveURL(new RegExp(`geo=${encodeURIComponent(firstCountry.value)}`, 'u'))
  await expect(breadcrumb.getByText(firstCountry.label)).toHaveAttribute('aria-current', 'page')
  await expect(map).toHaveAttribute('data-camera-scope', firstCountry.value)

  await breadcrumb.getByRole('button', { name: firstContinent.label }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(new RegExp(`#dashboard\\?geo=${encodeURIComponent(firstContinent.value)}$`, 'u'))
  await expect(country).toHaveValue(firstContinent.value)
  await expect(map).toHaveAttribute('data-camera-scope', firstContinent.value)

  await continent.selectOption(secondContinent.value)
  await expect(country).toHaveValue(secondContinent.value)
  await expect(map).toHaveAttribute('data-camera-scope', secondContinent.value)
  await expect.poll(() => country.locator('option').count()).toBeGreaterThanOrEqual(2)

  const secondCountries = (await selectOptions(country)).filter(
    ({ value }) => value !== secondContinent.value,
  )
  expect(secondCountries.length).toBeGreaterThan(0)
  const secondCountry = secondCountries[0]!
  await country.selectOption(secondCountry.value)
  await expect(page).toHaveURL(new RegExp(`geo=${encodeURIComponent(secondCountry.value)}`, 'u'))
  await expect(map).toHaveAttribute('data-camera-scope', secondCountry.value)

  await page.goBack()
  await expect(continent).toHaveValue(secondContinent.value)
  await expect(country).toHaveValue(secondContinent.value)
  await expect(map).toHaveAttribute('data-camera-scope', secondContinent.value)

  await page.goBack()
  await expect(continent).toHaveValue(firstContinent.value)
  await expect(map).toHaveAttribute('data-camera-scope', firstContinent.value)

  await page.goForward()
  await expect(continent).toHaveValue(secondContinent.value)
  await expect(map).toHaveAttribute('data-camera-scope', secondContinent.value)

  await page.getByRole('button', { name: 'Reset to Global' }).click()
  await expect(page).toHaveURL(/#dashboard$/u)
  await expect(country).toBeDisabled()
  await expect(map).toHaveAttribute('data-camera-scope', 'global')
})

async function selectOptions(select: Locator) {
  return select.locator('option').evaluateAll((options) =>
    options.map((option) => ({
      label: option.textContent?.trim() ?? '',
      value: (option as HTMLOptionElement).value,
    })),
  )
}
