package com.example.contractwatch.Model;

import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "contracts", indexes = {
        @Index(name = "idx_contract_end_date", columnList = "end_date"),
        @Index(name = "idx_contract_status", columnList = "status")
})
public class ContractWatch_model {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @NotBlank @Size(max = 160) @Column(nullable = false, length = 160)
    private String contractName;
    @NotBlank @Size(max = 160) @Column(nullable = false, length = 160)
    private String vendor;
    @Email @Size(max = 120) @Column(length = 120)
    private String vendorEmail;
    @NotNull @PositiveOrZero @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;
    @NotBlank @Pattern(regexp = "[A-Z]{3}") @Column(nullable = false, length = 3)
    private String currency = "INR";
    @NotNull @Column(nullable = false)
    private LocalDate startDate;
    @NotNull @Column(nullable = false)
    private LocalDate endDate;
    @NotNull @Min(0) @Max(3650) @Column(nullable = false)
    private Integer renewalNoticeDays = 30;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private ContractStatus status = ContractStatus.ACTIVE;
    @Column(length = 1000)
    private String notes;
    @Column(precision = 5, scale = 2)
    private BigDecimal discountPercent;
    @Column(precision = 14, scale = 2)
    private BigDecimal discountAmount;
    private LocalDate discountDeadline;
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist void onCreate() { createdAt = updatedAt = LocalDateTime.now(); }
    @PreUpdate void onUpdate() { updatedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getContractName() { return contractName; }
    public void setContractName(String contractName) { this.contractName = contractName; }
    public String getVendor() { return vendor; }
    public void setVendor(String vendor) { this.vendor = vendor; }
    public String getVendorEmail() { return vendorEmail; }
    public void setVendorEmail(String vendorEmail) { this.vendorEmail = vendorEmail; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public Integer getRenewalNoticeDays() { return renewalNoticeDays; }
    public void setRenewalNoticeDays(Integer renewalNoticeDays) { this.renewalNoticeDays = renewalNoticeDays; }
    public ContractStatus getStatus() { return status; }
    public void setStatus(ContractStatus status) { this.status = status; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public BigDecimal getDiscountPercent() { return discountPercent; }
    public void setDiscountPercent(BigDecimal discountPercent) { this.discountPercent = discountPercent; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public LocalDate getDiscountDeadline() { return discountDeadline; }
    public void setDiscountDeadline(LocalDate discountDeadline) { this.discountDeadline = discountDeadline; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
