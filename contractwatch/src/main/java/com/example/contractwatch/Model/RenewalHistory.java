package com.example.contractwatch.Model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "renewal_history")
public class RenewalHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Long contractId;
    @Column(nullable = false, length = 160)
    private String contractName;
    @Column(nullable = false)
    private LocalDate previousEndDate;
    @Column(nullable = false)
    private LocalDate newEndDate;
    @Column(precision = 14, scale = 2)
    private BigDecimal previousAmount;
    @Column(precision = 14, scale = 2)
    private BigDecimal newAmount;
    @Column(precision = 5, scale = 2)
    private BigDecimal discountPercent;
    @Column(nullable = false)
    private LocalDateTime renewedAt;

    protected RenewalHistory() { }
    public RenewalHistory(ContractWatch_model c, LocalDate previousEndDate, BigDecimal previousAmount, BigDecimal discountPercent) {
        this.contractId = c.getId(); this.contractName = c.getContractName(); this.previousEndDate = previousEndDate;
        this.newEndDate = c.getEndDate(); this.previousAmount = previousAmount; this.newAmount = c.getAmount();
        this.discountPercent = discountPercent; this.renewedAt = LocalDateTime.now();
    }
    public Long getId() { return id; }
    public Long getContractId() { return contractId; }
    public String getContractName() { return contractName; }
    public LocalDate getPreviousEndDate() { return previousEndDate; }
    public LocalDate getNewEndDate() { return newEndDate; }
    public BigDecimal getPreviousAmount() { return previousAmount; }
    public BigDecimal getNewAmount() { return newAmount; }
    public BigDecimal getDiscountPercent() { return discountPercent; }
    public LocalDateTime getRenewedAt() { return renewedAt; }
}
