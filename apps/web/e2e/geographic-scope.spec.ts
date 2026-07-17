import { expect, test } from '@playwright/test'

test('keeps geographic deep links, controls, camera and history synchronized', async ({ page }) => {
  await page.goto('./#dashboard?geo=country%3AIN')

  const continent = page.getByRole('combobox', { name: 'Continent' })
  const country = page.getByRole('combobox', { name: 'Country' })
  const map = page.locator('.taxalens-world-map__canvas')
  const breadcrumb = page.getByRole('navigation', { name: 'Geographic breadcrumb' })

  await expect(continent).toHaveValue('continent:asia')
  await expect(country).toHaveValue('country:IN')
  await expect(breadcrumb.getByText('India')).toHaveAttribute('aria-current', 'page')
  await expect(map).toHaveAttribute('data-camera-scope', 'country:IN', { timeout: 30_000 })

  await breadcrumb.getByRole('button', { name: 'Asia' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#dashboard\?geo=continent%3Aasia$/u)
  await expect(country).toHaveValue('continent:asia')
  await expect(map).toHaveAttribute('data-camera-scope', 'continent:asia')

  await continent.selectOption('continent:oceania')
  await expect(country).toHaveValue('continent:oceania')
  await expect(map).toHaveAttribute('data-camera-scope', 'continent:oceania')

  await country.selectOption('country:AU')
  await expect(page).toHaveURL(/#dashboard\?geo=country%3AAU$/u)
  await expect(map).toHaveAttribute('data-camera-scope', 'country:AU')

  await page.goBack()
  await expect(continent).toHaveValue('continent:oceania')
  await expect(country).toHaveValue('continent:oceania')
  await expect(map).toHaveAttribute('data-camera-scope', 'continent:oceania')

  await page.goBack()
  await expect(continent).toHaveValue('continent:asia')
  await expect(map).toHaveAttribute('data-camera-scope', 'continent:asia')

  await page.goForward()
  await expect(continent).toHaveValue('continent:oceania')
  await expect(map).toHaveAttribute('data-camera-scope', 'continent:oceania')

  await page.getByRole('button', { name: 'Reset to Global' }).click()
  await expect(page).toHaveURL(/#dashboard$/u)
  await expect(country).toBeDisabled()
  await expect(map).toHaveAttribute('data-camera-scope', 'global')
})
