import { expect, test } from '@playwright/test'

test('opens an inspected record in its exact Geographic Impact cell and table row', async ({
  page,
}) => {
  test.setTimeout(120_000)

  await page.goto('./#evidence-lens')
  await page.getByRole('button', { name: 'Inspect verified discovery record' }).click()
  const geography = page.locator('.geography-reference')
  await expect(
    geography.getByRole('heading', { name: 'Artifact-grounded geographic facts' }),
  ).toBeVisible({ timeout: 60_000 })
  await expect(
    geography.getByRole('img', { name: /Record geographic context mini-map/u }),
  ).toBeVisible()
  await expect(geography.getByText('Supported comparison cell').locator('..')).toContainText(
    'H3 resolution 7',
  )
  await expect(geography.getByText('Potential contribution').locator('..')).toContainText(
    'Potential coverage-gap cell',
  )
  await expect(
    geography.getByRole('heading', { name: 'Finest configured comparison supported' }),
  ).toBeVisible()

  const openImpact = geography.getByRole('link', { name: 'Open Geographic Impact' })
  const viewCell = geography.getByRole('link', { name: 'View records in this cell' })
  const openHref = await openImpact.getAttribute('href')
  const tableHref = await viewCell.getAttribute('href')
  expect(openHref).toMatch(/^#dashboard\?.*geo-cell=[0-9a-f]{15}.*geo-focus=lens$/u)
  expect(tableHref).toMatch(/^#dashboard\?.*geo-cell=[0-9a-f]{15}.*geo-focus=table$/u)
  const selectedCellId = new URLSearchParams(openHref!.split('?', 2)[1]).get('geo-cell')
  expect(selectedCellId).toMatch(/^[0-9a-f]{15}$/u)

  await openImpact.click()
  await expect(page).toHaveURL(new RegExp(`${escapeRegExp(openHref!)}$`, 'u'))
  await expect(page.getByText('Baseline and Flickr evidence mapped', { exact: true })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.locator('#geographic-impact-lens')).toBeFocused()
  await expect(
    page.locator('.selected-geography-details').getByRole('heading', {
      name: selectedCellId!,
    }),
  ).toBeVisible()

  await page.goto(`./${tableHref!}`)
  await expect(page.getByText('Baseline and Flickr evidence mapped', { exact: true })).toBeVisible({
    timeout: 60_000,
  })
  const selectedRow = page.getByRole('rowheader', { name: selectedCellId! }).locator('..')
  await expect(selectedRow).toBeFocused()
  await expect(selectedRow.getByRole('button', { name: `Selected ${selectedCellId!}` }))
    .toHaveAttribute('aria-pressed', 'true')
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
