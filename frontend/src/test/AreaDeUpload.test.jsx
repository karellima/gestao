import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AreaDeUpload from '../components/AreaDeUpload'

const renderUpload = (setFile = vi.fn(), file = null) => {
  const view = render(
    <AreaDeUpload file={file} setFile={setFile} inputRef={{ current: null }} />,
  )

  return { ...view, input: view.container.querySelector('input'), dropZone: view.container.firstChild, setFile }
}

const arquivo = nome => new File(['conteúdo'], nome, { type: 'application/octet-stream' })

describe('AreaDeUpload', () => {
  it('aceita planilha .xlsx escolhida pelo input', () => {
    const { input, setFile } = renderUpload()
    const file = arquivo('produtos.xlsx')

    fireEvent.change(input, { target: { files: [file] } })

    expect(setFile).toHaveBeenCalledWith(file)
  })

  it('aceita planilha .xls escolhida pelo input', () => {
    const { input, setFile } = renderUpload()
    const file = arquivo('produtos.xls')

    fireEvent.change(input, { target: { files: [file] } })

    expect(setFile).toHaveBeenCalledWith(file)
  })

  it('recusa PDF escolhido pelo input e mostra a mensagem', () => {
    const { input, setFile } = renderUpload()

    fireEvent.change(input, { target: { files: [arquivo('produtos.pdf')] } })

    expect(setFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Formato inválido. Envie um arquivo .xlsx ou .xls.')
  })

  it('recusa PDF com extensão maiúscula', () => {
    const { input, setFile } = renderUpload()

    fireEvent.change(input, { target: { files: [arquivo('produtos.PDF')] } })

    expect(setFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeVisible()
  })

  it('aceita XLSX com extensão maiúscula', () => {
    const { input, setFile } = renderUpload()
    const file = arquivo('produtos.XLSX')

    fireEvent.change(input, { target: { files: [file] } })

    expect(setFile).toHaveBeenCalledWith(file)
  })

  it('recusa arquivo inválido arrastado e mostra a mesma mensagem', () => {
    const { dropZone, setFile } = renderUpload()

    fireEvent.drop(dropZone, { dataTransfer: { files: [arquivo('produtos.pdf')] } })

    expect(setFile).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Formato inválido. Envie um arquivo .xlsx ou .xls.')
  })

  it('remove a mensagem quando uma planilha válida é escolhida depois', () => {
    const { input, setFile } = renderUpload()

    fireEvent.change(input, { target: { files: [arquivo('produtos.pdf')] } })
    fireEvent.change(input, { target: { files: [arquivo('produtos.XLSX')] } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(setFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'produtos.XLSX' }))
  })

  it('limpa a planilha anterior quando um arquivo inválido é escolhido', () => {
    const setFile = vi.fn()
    const { input } = renderUpload(setFile, arquivo('produtos.xlsx'))

    fireEvent.change(input, { target: { files: [arquivo('produtos.pdf')] } })

    expect(setFile).toHaveBeenCalledWith(null)
    expect(screen.getByRole('alert')).toBeVisible()
  })
})
