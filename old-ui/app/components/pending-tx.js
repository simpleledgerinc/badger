const Component = require('react').Component
const h = require('react-hyperscript')
const inherits = require('util').inherits
const actions = require('../../../ui/app/actions')
const clone = require('clone')
const log = require('loglevel')

const ethUtil = require('ethereumjs-util')
const BN = ethUtil.BN
const hexToBn = require('../../../app/scripts/lib/hex-to-bn')
const util = require('../util')
const MiniAccountPanel = require('./mini-account-panel')
const Copyable = require('./copyable')
const EthBalance = require('./eth-balance')
const addressSummary = util.addressSummary
const nameForAddress = require('../../lib/contract-namer')

const SLPSDK = require('slp-sdk/lib/SLP').default
const SLP = new SLPSDK()

module.exports = PendingTx
inherits(PendingTx, Component)
function PendingTx () {
  Component.call(this)
  this.state = {
    valid: true,
    txData: null,
    submitting: false,
  }
}

PendingTx.prototype.render = function () {
  const props = this.props
  const { currentCurrency } = props

  const conversionRate = props.conversionRate
  const txMeta = this.gatherTxMeta()
  const txParams = txMeta.txParams || {}

  // Account Details
  const address = txParams.from || props.selectedAddress
  const identity = props.identities[address] || { address: address }
  const account = props.accounts[address]
  const balance = account ? account.balance : '0'

  // recipient check
  const isValidAddress = !txParams.to || util.isValidAddress(txParams.to)

  // Calculate fee @ 1 sat/byte
  const txFeeBn = SLP.BitcoinCash.getByteCount({ P2PKH: 1 }, { P2PKH: 2 })

  const valueBn = SLP.BitcoinCash.toSatoshi(txParams.value) // new BN(txParams.value)
  const maxCost = txFeeBn + valueBn // txFeeBn.add(valueBn)

  const balanceBn = balance // new BN(balance)
  const insufficientBalance = balanceBn < maxCost // balanceBn.lt(maxCost)
  const buyDisabled =
    insufficientBalance ||
    !this.state.valid ||
    !isValidAddress ||
    this.state.submitting
  const showRejectAll = props.unconfTxListLength > 1

  this.inputs = []

  return h(
    'div',
    {
      key: txMeta.id,
    },
    [
      h(
        'form#pending-tx-form',
        {
          onSubmit: this.onSubmit.bind(this),
        },
        [
          // tx info
          h('div', [
            h(
              '.flex-row.flex-center',
              {
                style: {
                  maxWidth: '100%',
                },
              },
              [
                h(
                  MiniAccountPanel,
                  {
                    imageSeed: address,
                    picOrder: 'right',
                  },
                  [
                    h(
                      'span.font-small',
                      {
                        style: {
                          fontFamily: 'Montserrat Bold, Montserrat, sans-serif',
                        },
                      },
                      identity.name
                    ),

                    h(
                      Copyable,
                      {
                        value: ethUtil.toChecksumAddress(address),
                      },
                      [
                        h(
                          'span.font-small',
                          {
                            style: {
                              fontFamily:
                                'Montserrat Light, Montserrat, sans-serif',
                            },
                          },
                          addressSummary(address, 6, 4, false)
                        ),
                      ]
                    ),

                    h(
                      'span.font-small',
                      {
                        style: {
                          fontFamily:
                            'Montserrat Light, Montserrat, sans-serif',
                        },
                      },
                      [
                        h(EthBalance, {
                          value: balance,
                          conversionRate,
                          currentCurrency,
                          inline: true,
                          labelColor: '#F7861C',
                        }),
                      ]
                    ),
                  ]
                ),

                forwardCarrat(),

                this.miniAccountPanelForRecipient(),
              ]
            ),

            h(
              'style',
              `
            .table-box {
              margin: 7px 0px 0px 0px;
              width: 100%;
            }
            .table-box .row {
              margin: 0px;
              background: rgb(236,236,236);
              display: flex;
              justify-content: space-between;
              font-family: Montserrat Light, sans-serif;
              font-size: 13px;
              padding: 5px 25px;
            }
            .table-box .row .value {
              font-family: Montserrat Regular;
            }
          `
            ),

            h('.table-box', [
              // Ether Value
              // Currently not customizable, but easily modified
              // in the way that gas and gasLimit currently are.
              h('.row', [
                h('.cell.label', 'Amount'),
                h(EthBalance, {
                  value: valueBn,
                  currentCurrency,
                  conversionRate,
                }),
              ]),

              // Max Transaction Fee (calculated)
              h('.cell.row', [
                h('.cell.label', 'Transaction Fee'),
                h(EthBalance, {
                  value: txFeeBn.toString(),
                  currentCurrency,
                  conversionRate,
                }),
              ]),

              h(
                '.cell.row',
                {
                  style: {
                    fontFamily: 'Montserrat Regular',
                    background: 'white',
                    padding: '10px 25px',
                  },
                },
                [
                  h('.cell.label', 'Total'),
                  h(
                    '.cell.value',
                    {
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                      },
                    },
                    [
                      h(EthBalance, {
                        value: maxCost.toString(),
                        currentCurrency,
                        conversionRate,
                        inline: true,
                        labelColor: 'black',
                        fontSize: '16px',
                      }),
                    ]
                  ),
                ]
              ),
            ]), // End of Table
          ]),

          h(
            'style',
            `
          .conf-buttons button {
            margin-left: 10px;
            text-transform: uppercase;
          }
        `
          ),
          h(
            '.cell.row',
            {
              style: {
                textAlign: 'center',
              },
            },
            [
              txMeta.simulationFails
                ? h(
                    '.error',
                    {
                      style: {
                        fontSize: '0.9em',
                      },
                    },
                    'Transaction Error. Exception thrown in contract code.'
                  )
                : null,

              !isValidAddress
                ? h(
                    '.error',
                    {
                      style: {
                        fontSize: '0.9em',
                      },
                    },
                    'Recipient address is invalid. Sending this transaction will result in a loss of ETH.'
                  )
                : null,

              insufficientBalance
                ? h(
                    'span.error',
                    {
                      style: {
                        fontSize: '0.9em',
                      },
                    },
                    'Insufficient balance for transaction'
                  )
                : null,
            ]
          ),

          // send + cancel
          h(
            '.flex-row.flex-space-around.conf-buttons',
            {
              style: {
                display: 'flex',
                justifyContent: 'flex-end',
                margin: '14px 25px',
              },
            },
            [
              // Accept Button or Buy Button
              insufficientBalance
                ? h('button.btn-green', { onClick: props.buyEth }, 'Buy BCH')
                : h('input.confirm.btn-green', {
                    type: 'submit',
                    value: 'SUBMIT',
                    style: { marginLeft: '10px' },
                    disabled: buyDisabled,
                  }),

              h(
                'button.cancel.btn-red',
                {
                  onClick: props.cancelTransaction,
                },
                'Reject'
              ),
            ]
          ),
          showRejectAll
            ? h(
                '.flex-row.flex-space-around.conf-buttons',
                {
                  style: {
                    display: 'flex',
                    justifyContent: 'flex-end',
                    margin: '14px 25px',
                  },
                },
                [
                  h(
                    'button.cancel.btn-red',
                    {
                      onClick: props.cancelAllTransactions,
                    },
                    'Reject All'
                  ),
                ]
              )
            : null,
        ]
      ),
    ]
  )
}

PendingTx.prototype.miniAccountPanelForRecipient = function () {
  const props = this.props
  const txData = props.txData
  const txParams = txData.txParams || {}
  const isContractDeploy = !('to' in txParams)

  // If it's not a contract deploy, send to the account
  if (!isContractDeploy) {
    return h(
      MiniAccountPanel,
      {
        imageSeed: txParams.to,
        picOrder: 'left',
      },
      [
        h(
          'span.font-small',
          {
            style: {
              fontFamily: 'Montserrat Bold, Montserrat, sans-serif',
            },
          },
          nameForAddress(txParams.to, props.identities)
        ),

        h(
          Copyable,
          {
            value: ethUtil.toChecksumAddress(txParams.to),
          },
          [
            h(
              'span.font-small',
              {
                style: {
                  fontFamily: 'Montserrat Light, Montserrat, sans-serif',
                },
              },
              addressSummary(txParams.to, 6, 4, false)
            ),
          ]
        ),
      ]
    )
  } else {
    return h(
      MiniAccountPanel,
      {
        picOrder: 'left',
      },
      [
        h(
          'span.font-small',
          {
            style: {
              fontFamily: 'Montserrat Bold, Montserrat, sans-serif',
            },
          },
          'New Contract'
        ),
      ]
    )
  }
}

PendingTx.prototype.onSubmit = function (event) {
  event.preventDefault()
  const txMeta = this.gatherTxMeta()
  const valid = this.checkValidity()
  this.setState({ valid, submitting: true })
  if (valid) {
    this.props.sendTransaction(txMeta, event)
  } else {
    this.props.dispatch(actions.displayWarning('Invalid Transaction'))
    this.setState({ submitting: false })
  }
}

PendingTx.prototype.checkValidity = function () {
  const form = this.getFormEl()
  const valid = form.checkValidity()
  return valid
}

PendingTx.prototype.getFormEl = function () {
  const form = document.querySelector('form#pending-tx-form')
  // Stub out form for unit tests:
  if (!form) {
    return {
      checkValidity () {
        return true
      },
    }
  }
  return form
}

// After a customizable state value has been updated,
PendingTx.prototype.gatherTxMeta = function () {
  log.debug(`pending-tx gatherTxMeta`)
  const props = this.props
  const state = this.state
  const txData = clone(state.txData) || clone(props.txData)

  log.debug(`UI has defaulted to tx meta ${JSON.stringify(txData)}`)
  return txData
}

PendingTx.prototype.bnMultiplyByFraction = function (
  targetBN,
  numerator,
  denominator
) {
  const numBN = new BN(numerator)
  const denomBN = new BN(denominator)
  return targetBN.mul(numBN).div(denomBN)
}

function forwardCarrat () {
  return h('img', {
    src: 'images/forward-carrat.svg',
    style: {
      padding: '5px 6px 0px 10px',
      height: '37px',
    },
  })
}
